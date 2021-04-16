import { SNSEvent, SQSEvent, EventBridgeEvent } from 'aws-lambda';

import Lambda from '../src/index';
import mock from './mock';

describe('AWS Lambda Handler', () => {
	const lambda = new Lambda();

	const sqsDeleteMessageBatch = jest.fn().mockResolvedValue(undefined);
	lambda.sqsDeleteMessageBatch = sqsDeleteMessageBatch;

	// EventBridge
	const ruleArn: string = 'arn:aws:events:us-east-1:1234567890:rule/abcdefg';
	const notRuleArn: string = '';
	lambda.eventBridge(ruleArn, mock.processEventBridge);
	lambda.eventBridge(notRuleArn, mock.notProcessEventBridge);

	// SNS
	const topicArn: string = 'arn:aws:sns:us-east-1:1234567890:topic-1234';
	const notTopicArn: string = '';
	lambda.sns(topicArn, mock.processSns);
	lambda.sns(notTopicArn, mock.notProcessSns);

	// SQS
	const sqsArn: string = 'arn:aws:sqs:us-east-1:1234567890:sqs';
	const notSqsArn: string = '';
	lambda.sqs(sqsArn, mock.processSqs);
	lambda.sqs(notSqsArn, mock.notProcessSqs);

	// SQS Fifo
	const sqsFifoArn: string = 'arn:aws:sqs:us-east-1:1234567890:sqs-fifo';
	const notSqsFifoArn: string = '';
	lambda.sqsFifo(sqsFifoArn, mock.processSqsFifo);
	lambda.sqsFifo(notSqsFifoArn, mock.notProcessSqsFifo);

	const handler = lambda.handler;

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should process EventBridge event', () => {
		const eventBridgeEvent: EventBridgeEvent<string, Record<string, unknown>> = {
			id: '1',
			version: '1',
			account: '1234567890',
			time: '2021-12-02T20:21:00Z',
			region: 'us-east-1',
			source: 'aws.events',
			resources: [ruleArn],
			detail: {},
			'detail-type': 'Scheduled Event'
		};

		handler(eventBridgeEvent);
		expect(mock.processEventBridge).toHaveBeenCalled();
		Object.entries(mock).forEach(([key, value]) => {
			if (key !== 'processEventBridge') {
				expect(value).not.toHaveBeenCalled();
			}
		});
	});

	it('should process SNS event', () => {
		const snsEvent: SNSEvent = {
			Records: [
				{
					EventVersion: '1',
					EventSubscriptionArn: `${topicArn}:abcdefg`,
					EventSource: 'aws:sns',
					Sns: {
						SignatureVersion: '1',
						Timestamp: '2021-12-02T20:21:00Z',
						Signature: 'abcdefghijklmnopqrstuvwxyz',
						SigningCertUrl:
							'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-abcdefghijklmnopqrstuvwxyz.pem',
						MessageId: 'abcdefghijklmnopqrstuvwxyz',
						Message: 'Hello from SNS!',
						MessageAttributes: {},
						Type: 'Notification',
						UnsubscribeUrl:
							'https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&amp;SubscriptionArn=arn:aws:sns:us-east-1:1234567890:lambda:abcdefg',
						TopicArn: topicArn,
						Subject: 'TestInvoke'
					}
				}
			]
		};

		handler(snsEvent);
		expect(mock.processSns).toHaveBeenCalledWith(snsEvent.Records[0].Sns);
		Object.entries(mock).forEach(([key, value]) => {
			if (key !== 'processSns') {
				expect(value).not.toHaveBeenCalled();
			}
		});
	});

	it('should process SQS event', async () => {
		const sqsEvent: SQSEvent = {
			Records: [
				{
					messageId: '1',
					receiptHandle: '1',
					body: 'Hello from SQS!',
					attributes: {
						ApproximateReceiveCount: '1',
						SentTimestamp: '1234567890123',
						SenderId: 'abcdefghijklmnopqrstu',
						ApproximateFirstReceiveTimestamp: '1234567891234'
					},
					messageAttributes: {},
					md5OfBody: 'abcdefghijklmnopqrstuvwxyz012345',
					eventSource: 'aws:sqs',
					eventSourceARN: sqsArn,
					awsRegion: 'us-east-1'
				},
				{
					messageId: '2',
					receiptHandle: '2',
					body: 'FAILED',
					attributes: {
						ApproximateReceiveCount: '1',
						SentTimestamp: '1234567890123',
						SenderId: 'abcdefghijklmnopqrstu',
						ApproximateFirstReceiveTimestamp: '1234567891234'
					},
					messageAttributes: {},
					md5OfBody: 'abcdefghijklmnopqrstuvwxyz012345',
					eventSource: 'aws:sqs',
					eventSourceARN: sqsArn,
					awsRegion: 'us-east-1'
				},
				{
					messageId: '3',
					receiptHandle: '3',
					body: 'Hello from SQS!',
					attributes: {
						ApproximateReceiveCount: '1',
						SentTimestamp: '1234567890123',
						SenderId: 'abcdefghijklmnopqrstu',
						ApproximateFirstReceiveTimestamp: '1234567891234'
					},
					messageAttributes: {},
					md5OfBody: 'abcdefghijklmnopqrstuvwxyz012345',
					eventSource: 'aws:sqs',
					eventSourceARN: sqsArn,
					awsRegion: 'us-east-1'
				}
			]
		};

		try {
			await handler(sqsEvent);
		} catch (err) {
			expect(err).toEqual(new Error(`SQS Batch Failure: 2 of 3 succeeded`));
		}
		expect(mock.processSqs).toBeCalledTimes(3);
		expect(mock.processSqs).toHaveBeenCalledWith(sqsEvent.Records[0]);
		expect(mock.processSqs).toHaveBeenCalledWith(sqsEvent.Records[1]);
		expect(mock.processSqs).toHaveBeenCalledWith(sqsEvent.Records[2]);
		expect(sqsDeleteMessageBatch).toHaveBeenCalledWith(sqsArn, [
			{
				Id: sqsEvent.Records[0].messageId,
				ReceiptHandle: sqsEvent.Records[0].receiptHandle
			},
			{
				Id: sqsEvent.Records[2].messageId,
				ReceiptHandle: sqsEvent.Records[2].receiptHandle
			}
		]);
		Object.entries(mock).forEach(([key, value]) => {
			if (key !== 'processSqs') {
				expect(value).not.toHaveBeenCalled();
			}
		});
	});

	it('should process SQS event', async () => {
		const sqsFifoEvent: SQSEvent = {
			Records: [
				{
					messageId: '1',
					receiptHandle: '1',
					body: 'Hello from SQS!',
					attributes: {
						ApproximateReceiveCount: '1',
						SentTimestamp: '1234567890123',
						SenderId: 'abcdefghijklmnopqrstu',
						ApproximateFirstReceiveTimestamp: '1234567891234'
					},
					messageAttributes: {},
					md5OfBody: 'abcdefghijklmnopqrstuvwxyz012345',
					eventSource: 'aws:sqs',
					eventSourceARN: sqsFifoArn,
					awsRegion: 'us-east-1'
				},
				{
					messageId: '2',
					receiptHandle: '2',
					body: 'FAILED',
					attributes: {
						ApproximateReceiveCount: '1',
						SentTimestamp: '1234567890123',
						SenderId: 'abcdefghijklmnopqrstu',
						ApproximateFirstReceiveTimestamp: '1234567891234'
					},
					messageAttributes: {},
					md5OfBody: 'abcdefghijklmnopqrstuvwxyz012345',
					eventSource: 'aws:sqs',
					eventSourceARN: sqsFifoArn,
					awsRegion: 'us-east-1'
				},
				{
					messageId: '3',
					receiptHandle: '3',
					body: 'Hello from SQS!',
					attributes: {
						ApproximateReceiveCount: '1',
						SentTimestamp: '1234567890123',
						SenderId: 'abcdefghijklmnopqrstu',
						ApproximateFirstReceiveTimestamp: '1234567891234'
					},
					messageAttributes: {},
					md5OfBody: 'abcdefghijklmnopqrstuvwxyz012345',
					eventSource: 'aws:sqs',
					eventSourceARN: sqsFifoArn,
					awsRegion: 'us-east-1'
				}
			]
		};

		try {
			await handler(sqsFifoEvent);
		} catch (err) {
			expect(err).toEqual(new Error('SQS FAILED'));
		}
		expect(mock.processSqsFifo).toBeCalledTimes(2);
		expect(mock.processSqsFifo).toHaveBeenCalledWith(sqsFifoEvent.Records[0]);
		expect(mock.processSqsFifo).toHaveBeenCalledWith(sqsFifoEvent.Records[1]);
		expect(sqsDeleteMessageBatch).toHaveBeenCalledWith(sqsFifoArn, [
			{
				Id: sqsFifoEvent.Records[0].messageId,
				ReceiptHandle: sqsFifoEvent.Records[0].receiptHandle
			}
		]);
		Object.entries(mock).forEach(([key, value]) => {
			if (key !== 'processSqsFifo') {
				expect(value).not.toHaveBeenCalled();
			}
		});
	});
});
