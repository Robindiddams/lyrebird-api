import { APIGatewayEvent, S3Event, Context, Handler } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import * as crypto from 'crypto';
import { TaskRecord, modelResp } from './types';
import { Translate } from 'aws-sdk';
import * as request from 'request-promise-native';

const dynamodb = new AWS.DynamoDB({
	region: 'us-east-1',
});

const s3 = new AWS.S3({
	region: 'us-east-1',
});

// const uploadBucket = "lyrebird-uploads";
const soundBucket = 'lyrebird-sounds';
const modelURL = 'http://3.94.22.232:8080'

const makeID = () => {
	return crypto.randomBytes(5).toString('hex');
}

const standardHeaders = {
	"Access-Control-Allow-Origin" : "*", // Required for CORS support to work
	"Access-Control-Allow-Credentials" : true // Required for cookies, authorization headers with HTTPS
}

const getTaskRecords = async (task_ids: Array<string> ) => {
	const keys = task_ids.map((task_id) => {
		return {
			'id': {
				S: task_id,
			}
		}
	});
	const output = await dynamodb.batchGetItem({
		RequestItems: {
			'lyrebird-tasks': {
				Keys: keys,
			}
		}
	}).promise();
	const records = output.Responses['lyrebird-tasks'].map((item) => { return AWS.DynamoDB.Converter.unmarshall(item) });
	console.log(records)
	if (!records) {
		throw new Error(`no record of task: ${task_ids}`);
	}
	return records as Array<TaskRecord>;
}

export const startModel: Handler = async (event: APIGatewayEvent, context: Context) => {
	try {
		if (!event.queryStringParameters) {
			return {
				headers: standardHeaders,
				statusCode: 400,
				body: JSON.stringify({
					success: false,
					message: 'missing seed',
				}),
			}; 
		}
		const {seed} = event.queryStringParameters;
		// TODO: pass seed
		const task_id = makeID();
		let ts = Date.now() / 1000;
		const dynarow: TaskRecord = {
			id: task_id,
			started_ts: ts,
			status: 'created',
			ttl: ts + 3600,
		};
		// invoke model in fargate
		console.log('staring model')
		const data = await request(`${modelURL}/?task_id=${task_id}`);
    const started = JSON.parse(data) as modelResp
		if (!started.success) {
			throw new Error('error starting model');
		}
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
		let task_ids = [];
		if (event.body) {
			const body = JSON.parse(event.body);
			task_ids = body.task_ids;
		} else {
			return {
				headers: standardHeaders,
				statusCode: 400,
				body: JSON.stringify({
					success: false,
					message: 'missing task ids',
				}),
			}; 
		}
		const tasks = await getTaskRecords(task_ids);
		const statuses = tasks.map((task) => {
			 if (task.status === 'done' && task.completed_path) {
					const url = s3.getSignedUrl('getObject', { Bucket: soundBucket, Key: task.completed_path, Expires: 300 });
					return {
						task_id: task.id,
						status: task.status,
						download_url: url,
					};
			 } else {
				 return {
						task_id: task.id,
						status: task.status,
				 }
			 }
		});
		return {
			headers: standardHeaders,
			statusCode: 200,
			body: JSON.stringify({
				success: true,
				tasks: statuses,
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
