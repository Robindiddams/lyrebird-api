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
const soundBucket = "lyrebird-sounds";

const makeID = () => {
	return crypto.randomBytes(5).toString('hex');
}

const standardHeaders = {
	"Access-Control-Allow-Origin" : "*", // Required for CORS support to work
	"Access-Control-Allow-Credentials" : true // Required for cookies, authorization headers with HTTPS
}

const getTaskRecord = async (task_id: string) => {
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
		throw new Error(`no record of task: ${task_id}`);
	}
	return record as TaskRecord;
}

export const getUploadURL: Handler = async (event: APIGatewayEvent, context: Context) => {
	try {
		const task_id = makeID();
		let ts = Date.now() / 1000;
		const dynarow: TaskRecord = {
			id: task_id,
			upload_ts: ts,
			ttl: ts + 3600,
		};
		const uploadpath = `task_${task_id}`;
		const upload_url = s3.getSignedUrl('putObject', {
			Bucket: uploadBucket,
			Key: uploadpath,
			Expires: 60,
			ContentType: 'application/octet-stream',
		});
		await dynamodb.putItem({
			TableName: 'lyrebird-tasks',
			Item: AWS.DynamoDB.Converter.marshall(dynarow),
		}).promise();
		return {
			headers: standardHeaders,
			statusCode: 200,
			body: JSON.stringify({
				success: true,
				task_id,
				upload_url,
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
		const task = await getTaskRecord(task_id);
		if (task.completed_path) {
			const url = s3.getSignedUrl('getObject', { Bucket: soundBucket, Key: task.completed_path, Expires: 60 });
			return {
				headers: standardHeaders,
				statusCode: 200,
				body: JSON.stringify({
					success: true,
					completed: true,
					download_url: url,
				}),
			};
		}
		return {
			headers: standardHeaders,
			statusCode: 200,
			body: JSON.stringify({
				success: true,
				completed: false,
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
