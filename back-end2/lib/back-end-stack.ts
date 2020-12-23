import * as cdk from '@aws-cdk/core';
import * as appsync from '@aws-cdk/aws-appsync';
import * as ddb from '@aws-cdk/aws-dynamodb';
import * as lambda from '@aws-cdk/aws-lambda';
import * as events from "@aws-cdk/aws-events";
import * as targets from "@aws-cdk/aws-events-targets";

export class BackEndStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
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

}
}
