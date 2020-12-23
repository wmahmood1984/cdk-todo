import * as cdk from '@aws-cdk/core';
import * as appsync from '@aws-cdk/aws-appsync';
import * as ddb from '@aws-cdk/aws-dynamodb';
import * as lambda from '@aws-cdk/aws-lambda';
import * as events from "@aws-cdk/aws-events";
import * as targets from "@aws-cdk/aws-events-targets";
import * as s3 from '@aws-cdk/aws-s3'
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as origins from '@aws-cdk/aws-cloudfront-origins';
import * as s3Deployment from '@aws-cdk/aws-s3-deployment'
import * as CodePipeline from '@aws-cdk/aws-codepipeline'
import * as CodePipelineAction from '@aws-cdk/aws-codepipeline-actions'
import * as CodeBuild from '@aws-cdk/aws-codebuild'
import { PolicyStatement } from '@aws-cdk/aws-iam';

export class BackEndStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);



   // Creates the AppSync API
   const api = new appsync.GraphqlApi(this, 'Api', {
    name: 'cdk-notes-appsync-api',
    schema: appsync.Schema.fromAsset('graphql/schema.graphql'),
    authorizationConfig: {
      defaultAuthorization: {
        authorizationType: appsync.AuthorizationType.API_KEY,
        
      },
    },
    logConfig: { fieldLogLevel: appsync.FieldLogLevel.ALL },
    xrayEnabled: true,
  });

  const httpDs : any = api.addHttpDataSource(
    "ds",
    "https://events." + this.region + ".amazonaws.com/", // This is the ENDPOINT for eventbridge.
    {
      name: "httpDsWithEventBridge",
      description: "From Appsync to Eventbridge",
      authorizationConfig: {
        signingRegion: this.region,
        signingServiceName: "events",
      },
    }
  );
  events.EventBus.grantPutEvents(httpDs);

  const putEventResolver = httpDs.createResolver({
    typeName: "Mutation",
    fieldName: "createEvent",
    requestMappingTemplate: appsync.MappingTemplate.fromFile("request.vtl"),
    responseMappingTemplate: appsync.MappingTemplate.fromFile("response.vtl"),
  });

   // TESTING ECHO LAMBDA
const echoLambda : any = new lambda.Function(this, "echoFunction", {
  code: lambda.Code.fromAsset('lambda-fns'),
  handler: "createNote2.handler",
  runtime: lambda.Runtime.NODEJS_10_X,
});

  // RULE ON DEFAULT EVENT BUS TO TARGET ECHO LAMBDA
const rule = new events.Rule(this, "AppSyncEventBridgeRule", {
  eventPattern: {
    source: ["eru-appsync-events"], // every event that has source = "eru-appsync-events" will be sent to our echo lambda
  },
});
rule.addTarget(new targets.LambdaFunction(echoLambda));

  // Prints out the AppSync GraphQL endpoint to the terminal
  new cdk.CfnOutput(this, "GraphQLAPIURL", {
   value: api.graphqlUrl
  });

  // Prints out the AppSync GraphQL API key to the terminal
  new cdk.CfnOutput(this, "GraphQLAPIKey", {
    value: api.apiKey || ''
  });

  // Prints out the stack region to the terminal
  new cdk.CfnOutput(this, "Stack Region", {
    value: this.region
  });

  // lib/appsync-cdk-app-stack.ts
const notesLambda = new lambda.Function(this, 'AppSyncNotesHandler', {
  runtime: lambda.Runtime.NODEJS_12_X,
  handler: 'main.handler',
  code: lambda.Code.fromAsset('lambda-fns'),
  memorySize: 1024
});

// Set the new Lambda function as a data source for the AppSync API
const lambdaDs = api.addLambdaDataSource('lambdaDatasource', notesLambda);

// lib/appsync-cdk-app-stack.ts
lambdaDs.createResolver({
  typeName: "Query",
  fieldName: "getNoteById"
});

lambdaDs.createResolver({
  typeName: "Query",
  fieldName: "listNotes"
});

lambdaDs.createResolver({
  typeName: "Mutation",
  fieldName: "createNote"
});

lambdaDs.createResolver({
  typeName: "Mutation",
  fieldName: "deleteNote"
});

lambdaDs.createResolver({
  typeName: "Mutation",
  fieldName: "updateNote"
});


// lib/appsync-cdk-app-stack.ts
const notesTable = new ddb.Table(this, 'CDKNotesTable2', {
  billingMode: ddb.BillingMode.PAY_PER_REQUEST,
  partitionKey: {
    name: 'id',
    type: ddb.AttributeType.STRING,
  },
});
// enable the Lambda function to access the DynamoDB table (using IAM)
notesTable.grantFullAccess(notesLambda)
notesTable.grantFullAccess(echoLambda)

// Create an environment variable that we will use in the function code
notesLambda.addEnvironment('NOTES_TABLE', notesTable.tableName);
echoLambda.addEnvironment('NOTES_TABLE', notesTable.tableName);


//Deploy Gatsby on s3 bucket
const myBucket = new s3.Bucket(this, "GATSBYbuckets", {
  versioned: true,       
  websiteIndexDocument: "index.html"
});

//say
const dist = new cloudfront.Distribution(this, 'myDistribution', {
  defaultBehavior: { origin: new origins.S3Origin(myBucket) }
});

new s3Deployment.BucketDeployment(this, "deployStaticWebsite", {
  sources: [s3Deployment.Source.asset("../front-end2/public")],
  destinationBucket: myBucket,
  distribution: dist
});

new cdk.CfnOutput(this, "CloudFrontURL", {
  value: dist.domainName
});

const sourceOutput = new CodePipeline.Artifact();

// Artifact from build stage
const S3Output = new CodePipeline.Artifact();

//Code build action, Here you will define a complete build
const s3Build = new CodeBuild.PipelineProject(this, 's3Build', {
  buildSpec: CodeBuild.BuildSpec.fromObject({
    version: '0.2',
    phases: {
      install: {
        "runtime-versions": {
          "nodejs": 12
        },
        commands: [
          
          'cd front-end2',
          'npm i -g gatsby',
          'npm install',
        ],
      },
      build: {
        commands: [
          'gatsby build',
        ],
      },
    },
    artifacts: {
      'base-directory': './front-end2/public',   ///outputting our generated Gatsby Build files to the public directory
      "files": [
        '**/*'
      ]
    },
  }),
  environment: {
    buildImage: CodeBuild.LinuxBuildImage.STANDARD_3_0,   ///BuildImage version 3 because we are using nodejs environment 12
  },
});

const policy :any = new PolicyStatement();
    policy.addActions('s3:*');
    policy.addResources('*');

    s3Build.addToRolePolicy(policy);

    const pipeline = new CodePipeline.Pipeline(this, 'GatsbyPipeline', {
      crossAccountKeys: false,  //Pipeline construct creates an AWS Key Management Service (AWS KMS) which cost $1/month. this will save your $1.
      restartExecutionOnUpdate: true,  //Indicates whether to rerun the AWS CodePipeline pipeline after you update it.
    });
const oauth : any = cdk.SecretValue.secretsManager('GitHubToken2')

    //First Stage Source
    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new CodePipelineAction.GitHubSourceAction({
          actionName: 'Checkout',
          owner: 'wmahmood1984',
          repo: "cdk-todo",
          oauthToken: oauth, ///create token on github and save it on aws secret manager
          output: sourceOutput,                                       ///Output will save in the sourceOutput Artifact
          branch: "master",                                           ///Branch of your repo
        }),
      ],
    })

    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new CodePipelineAction.CodeBuildAction({
          actionName: 's3Build',
          project: s3Build,
          input: sourceOutput,
          outputs: [S3Output],
        }),
      ],
    })

    pipeline.addStage({
      stageName: 'Deploy',
      actions: [
        new CodePipelineAction.S3DeployAction({
          actionName: 's3Build',
          input: S3Output,
          bucket: myBucket,
        }),
      ],
    })


}
}
