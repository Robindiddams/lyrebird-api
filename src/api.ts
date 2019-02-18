import { APIGatewayEvent, S3Event, Context, Handler } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import * as crypto from 'crypto';
import { TaskRecord } from './types';
const dynamodb = new AWS.DynamoDB({
	region: 'us-east-1',
});

const s3 = new AWS.S3({
	region: 'us-east-1',
});

const uploadBucket = "lyrebird-uploads";

const makeID = () => {
	return crypto.randomBytes(5).toString('hex');
}

const standardHeaders = {
	"Access-Control-Allow-Origin" : "*", // Required for CORS support to work
	"Access-Control-Allow-Credentials" : true // Required for cookies, authorization headers with HTTPS
}

export const upload: Handler = async (event: APIGatewayEvent, context: Context) => {
	try {
		const data = event.body;
		const task_id = makeID();
		let ts = Date.now() / 1000;
		const dynarow: TaskRecord = {
			id: task_id,
			upload_ts: ts,
			upload_path: `task_${task_id}`,
			ttl: ts + 3600,
		};		
		await dynamodb.putItem({
			TableName: 'lyrebird-tasks',
			Item: AWS.DynamoDB.Converter.marshall(dynarow),
		}).promise();
		await s3.putObject({
			Body: data, 
			Bucket: uploadBucket, 
			Key: dynarow.upload_path,
		}).promise();
		return {
			headers: standardHeaders,
			statusCode: 200,
			body: JSON.stringify({
				success: true,
				task_id,
			}),
		};
	} catch (e) {
		console.error('ERROR:', e.message);
		return {
			headers: standardHeaders,
			statusCode: 500,
			body: JSON.stringify({
				success: false,
				message: e.message,
			}),
		};
  }
}

export const status : Handler = async (event: APIGatewayEvent, context: Context) => {
	try {
		let task_id = '';
		if (event.queryStringParameters) {
			task_id = event.queryStringParameters.task_id;
		} else {
			return {
				headers: standardHeaders,
				statusCode: 400,
				body: JSON.stringify({
					success: false,
					message: 'missing task id',
				}),
			}; 
		}
		const output = await dynamodb.getItem({
			TableName: 'lyrebird-tasks',
			Key: {
				"id": {
					S: task_id,
				},
			},
		}).promise();
		const record = AWS.DynamoDB.Converter.unmarshall(output.Item);
		if (!record) {
			return {
				headers: standardHeaders,
				statusCode: 500,
				body: JSON.stringify({
					success: false,
					message: "task not found",
				}),
			};
		}
		const task = record as TaskRecord;
		let completed = false;
		if (task.completed_path) {
			completed = true
		}
		return {
			headers: standardHeaders,
			statusCode: 200,
			body: JSON.stringify({
				success: true,
				completed,
			}),
		};
	} catch (e) {
		console.error('ERROR:', e.message);
		return {
			headers: standardHeaders,
			statusCode: 500,
			body: JSON.stringify({
				success: false,
				message: e.message,
			}),
		};
  }
}
