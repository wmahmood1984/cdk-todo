// lambda-fns/createNote.ts
const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();
import Note from './Note';

exports.handler = async (event: any)=> {
    const params = {
        TableName: process.env.NOTES_TABLE,
        Item: event.detail
    }
    try {
        await docClient.put(params).promise();
        console.log(event.detail)
        return event.detail;
    } catch (err) {
        console.log('DynamoDB error: ', err);
        return null;
    }
}
