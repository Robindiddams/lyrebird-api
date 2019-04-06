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
				"#CP": "completed_path",
				"#S": "status",
      }, 
      ExpressionAttributeValues: {
        ":p": {
          S: key,
        },
        ":ts": {
          N: ts.toString(),
				},
				":s": {
					S: 'done',
				}
      },
      Key: {
        'id': {
          S: task_id,
        }
      }, 
      TableName: "lyrebird-tasks", 
      UpdateExpression: "SET #CTS = :ts, #CP = :p, #S = :s"
    }).promise();
	} catch (e) {
		console.error('Event:', JSON.stringify(event, null, 2));
		console.error('ERROR:', e.message);
	}
}
