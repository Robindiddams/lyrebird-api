import { APIGatewayEvent, S3Event, Context, Handler } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import * as crypto from 'crypto';
import { TaskRecord } from './types';
import { Translate } from 'aws-sdk';
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

const getOneTaskRecord = async (task_id: string) => {
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

export const statusOne : Handler = async (event: APIGatewayEvent, context: Context) => {
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
		const task = await getOneTaskRecord(task_id);
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
		console.log(tasks);
		const statuses = tasks.map((task) => {
			 if (task.completed_path) {
					const url = s3.getSignedUrl('getObject', { Bucket: soundBucket, Key: task.completed_path, Expires: 300 });
					return {
						task_id: task.id,
						completed: true,
						download_url: url,
					};
			 } else {
				 return {
					 task_id: task.id,
					 completed: false,
				 }
			 }
		});
		// if (task.completed_path) {
		// 	const url = s3.getSignedUrl('getObject', { Bucket: soundBucket, Key: task.completed_path, Expires: 60 });
		// 	return {
		// 		headers: standardHeaders,
		// 		statusCode: 200,
		// 		body: JSON.stringify({
		// 			success: true,
		// 			completed: true,
		// 			download_url: url,
		// 		}),
		// 	};
		// }
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
