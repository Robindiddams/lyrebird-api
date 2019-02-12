import { APIGatewayEvent, Callback, Context, Handler } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import * as crypto from 'crypto';

const dynamodb = new AWS.DynamoDB({
	region: 'us-east-1',
});

const s3 = new AWS.S3({
	region: 'us-east-1',
});

const uploadBucket = "lyrebird-uploads";

const hash = (data) => {
	return crypto.createHash('sha256').update(data).digest('base64');
};

const standardHeaders = {
	"Access-Control-Allow-Origin" : "*", // Required for CORS support to work
	"Access-Control-Allow-Credentials" : true // Required for cookies, authorization headers with HTTPS
}

export const upload: Handler = async (event: APIGatewayEvent, context: Context) => {
	try {
		let qsParm = '';
		if (event.queryStringParameters) {
			qsParm = event.queryStringParameters.param;
		}
		const data = event.body;
		const upload_ts = Date.now() / 1000;
		const task_id = hash(`${upload_ts}-lyrebird`);
		const path = `task_${task_id}`;
		await dynamodb.putItem({
			TableName: 'lyrebird-tasks',
			Item: AWS.DynamoDB.Converter.marshall({
				id: task_id,
				ttl: upload_ts + 3600,
				uploadPath: path,
				upload_ts,
			}),
		}).promise();
		await s3.putObject({
			Body: data, 
			Bucket: uploadBucket, 
			Key: path,
		}).promise();
		return {
			headers: standardHeaders,
			statusCode: 200,
			body: JSON.stringify({
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