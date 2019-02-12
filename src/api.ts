import { APIGatewayEvent, Callback, Context, Handler } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import * as crypto from 'crypto';

const dynamodb = new AWS.DynamoDB({
	region: 'us-east-1',
});

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
		return {
			headers: standardHeaders,
			statusCode: 200,
			body: JSON.stringify({
				success: true,
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