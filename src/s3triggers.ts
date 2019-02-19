import { APIGatewayEvent, S3Event, Context, Handler } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const dynamodb = new AWS.DynamoDB({
	region: 'us-east-1',
});

const s3 = new AWS.S3({
	region: 'us-east-1',
});

const taskRE = /^task_(.*)$/;
const getTaskFromKey = (key: string) => {
  if (!taskRE.test(key)) {
    throw new Error(`key '${key}' does not match standard form task_<id>`)
  }
  return key.match(taskRE)[1];
}

// preprocess is called when a new recording is put into the upload bucket
export const preprocess : Handler = async (event: S3Event, context: Context) => {
	try {
		if (event.Records.length != 1) {
			throw new Error(`number of records is not one`)
		}
		const task_id = getTaskFromKey(event.Records[0].s3.object.key);
		console.log(`starting preprocess for task ${task_id}`);
		await dynamodb.updateItem({
      ExpressionAttributeNames: {
        "#UP": "upload_path", 
      }, 
      ExpressionAttributeValues: {
        ":u": {
          S: `task_${task_id}`,
        },
      },
      Key: {
        'id': {
          S: task_id,
        }
      }, 
      TableName: "lyrebird-tasks", 
      UpdateExpression: "SET #UP = :u"
    }).promise();
		// TODO(robin): Invoke model
		await s3.copyObject({
			Bucket: 'lyrebird-sounds', 
			CopySource: `/lyrebird-uploads/task_${task_id}`, 
			Key: `task_${task_id}`,
		 }).promise();
	} catch (e) {
			console.error('Event:', JSON.stringify(event, null, 2));
			console.error('ERROR:', e.message);
	}
}

// preprocess is called when a new sound is put into the sounds bucket
export const postprocess : Handler = async (event: S3Event, context: Context) => {
	try {
		if (event.Records.length != 1) {
			throw new Error(`number of records is not one`)
		}
		const key = event.Records[0].s3.object.key;
    const task_id = getTaskFromKey(key);
		console.log(`starting postprocess for task ${task_id}`);
    const ts = Date.now() / 1000;
    await dynamodb.updateItem({
      ExpressionAttributeNames: {
        "#CTS": "completed_ts", 
        "#CP": "completed_path"
      }, 
      ExpressionAttributeValues: {
        ":p": {
          S: `task_${task_id}`,
        },
        ":ts": {
          N: ts.toString(),
        }, 
      },
      Key: {
        'id': {
          S: task_id,
        }
      }, 
      TableName: "lyrebird-tasks", 
      UpdateExpression: "SET #CTS = :ts, #CP = :p"
    }).promise();
	} catch (e) {
		console.error('Event:', JSON.stringify(event, null, 2));
		console.error('ERROR:', e.message);
	}
}
