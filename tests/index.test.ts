import { SNSEvent, SQSEvent, SQSRecord, MSKEvent, EventBridgeEvent } from 'aws-lambda';

import { Lambda } from '../src/index';

const mock = {
	processScheduledEvent: jest.fn(),
	notProcessScheduledEvent: jest.fn(),
	processEventBridge: jest.fn(),
	notProcessEventBridge: jest.fn(),
	processSns: jest.fn(),
	notProcessSns: jest.fn(),
	processSqs: jest.fn(async (record: SQSRecord): Promise<void> => {
		if (record.body === 'FAILED') {
			throw new Error('SQS FAILED');
		}
	}),
	notProcessSqs: jest.fn(),
	processSqsFifo: jest.fn(async (record: SQSRecord): Promise<void> => {
		if (record.body === 'FAILED') {
			throw new Error('SQS FAILED');
		}
	}),
	notProcessSqsFifo: jest.fn(),
	processMsk: jest.fn(),
	notProcessMsk: jest.fn()
};

describe('AWS Lambda Handler', () => {
	const lambda = new Lambda();

	const sqsDeleteMessageBatch = jest.fn().mockResolvedValue(undefined);
	lambda.sqsDeleteMessageBatch = sqsDeleteMessageBatch;

	// Scheduled Event
	const ruleArn = 'arn:aws:events:us-east-1:1234567890:rule/abcdefg';
	const notRuleArn = '';
	lambda.scheduledEvent(ruleArn, mock.processScheduledEvent);
	lambda.scheduledEvent(notRuleArn, mock.notProcessScheduledEvent);

	// EventBridge Event
	const resourceArn = 'arn:aws:rds:us-east-1:1234567890:db:rds-1234';
	const notResourceArn = '';
	lambda.eventBridge(resourceArn, mock.processEventBridge);
	lambda.eventBridge(notResourceArn, mock.notProcessEventBridge);

	// SNS
	const topicArn = 'arn:aws:sns:us-east-1:1234567890:topic-1234';
	const notTopicArn = '';
	lambda.sns(topicArn, mock.processSns);
	lambda.sns(notTopicArn, mock.notProcessSns);

	// SQS
	const sqsArn = 'arn:aws:sqs:us-east-1:1234567890:sqs';
	const notSqsArn = '';
	lambda.sqs(sqsArn, mock.processSqs);
	lambda.sqs(notSqsArn, mock.notProcessSqs);

	// SQS Fifo
	const sqsFifoArn = 'arn:aws:sqs:us-east-1:1234567890:sqs-fifo';
	const notSqsFifoArn = '';
	lambda.sqsFifo(sqsFifoArn, mock.processSqsFifo);
	lambda.sqsFifo(notSqsFifoArn, mock.notProcessSqsFifo);

	// SQS Fifo
	const mskArn = 'arn:aws:kafka:us-east-1:1234567890:cluster/demo/00000000-0000-0000-0000-000000000000-0';
	const mskTopic = 'msk-topic';
	const notMskArn = '';
	lambda.msk(mskArn, mskTopic, mock.processMsk);
	lambda.msk(notMskArn, mskTopic, mock.notProcessMsk);

	const handler = lambda.handler;

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('scheduledEvent()', () => {
		test('should process scheduled event', async () => {
			const scheduledEvent: EventBridgeEvent<'Scheduled Event', Record<string, never>> = {
				id: '1',
				version: '1',
				account: '1234567890',
				time: '2020-02-02T20:02:02Z',
				region: 'us-east-1',
				source: 'aws.events',
				resources: [ruleArn],
				detail: {},
				'detail-type': 'Scheduled Event'
			};

			await handler(scheduledEvent);
			expect(mock.processScheduledEvent).toHaveBeenCalled();

			const fns = Object.entries(mock)
				.filter(([key]) => key !== 'processScheduledEvent')
				.map(([, value]) => value);

			fns.forEach((fn) => {
				expect(fn).not.toHaveBeenCalled();
			});
		});
	});

	describe('eventBridge()', () => {
		test('should process EventBridge event', async () => {
			const eventBridgeEvent: EventBridgeEvent<string, Record<string, unknown>> = {
				id: '1',
				version: '1',
				account: '1234567890',
				time: '2020-02-02T20:02:02Z',
				region: 'us-east-1',
				source: 'aws.rds',
				resources: [resourceArn],
				detail: {
					'action-type': 'PUSH',
					'image-digest': 'sha256:',
					'image-tag': 'latest',
					'repository-name': 'test',
					result: 'SUCCESS'
				},
				'detail-type': 'ECR Image Action'
			};

			await handler(eventBridgeEvent);
			expect(mock.processEventBridge).toHaveBeenCalled();

			const fns = Object.entries(mock)
				.filter(([key]) => key !== 'processEventBridge')
				.map(([, value]) => value);

			fns.forEach((fn) => {
				expect(fn).not.toHaveBeenCalled();
			});
		});
	});

	describe('sns()', () => {
		test('should process SNS event', async () => {
			const snsEvent: SNSEvent = {
				Records: [
					{
						EventVersion: '1',
						EventSubscriptionArn: `${topicArn}:abcdefg`,
						EventSource: 'aws:sns',
						Sns: {
							SignatureVersion: '1',
							Timestamp: '2020-02-02T20:02:02Z',
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

			await handler(snsEvent);
			expect(mock.processSns).toHaveBeenCalledWith(snsEvent.Records[0].Sns);

			const fns = Object.entries(mock)
				.filter(([key]) => key !== 'processSns')
				.map(([, value]) => value);

			fns.forEach((fn) => {
				expect(fn).not.toHaveBeenCalled();
			});
		});
	});

	describe('sqs()', () => {
		test('should process SQS event', async () => {
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

			await expect(handler(sqsEvent)).rejects.toThrow(`SQS Batch Failure: 1 of 3 failed`);
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

			const fns = Object.entries(mock)
				.filter(([key]) => key !== 'processSqs')
				.map(([, value]) => value);

			fns.forEach((fn) => {
				expect(fn).not.toHaveBeenCalled();
			});
		});
	});

	describe('sqsFifo()', () => {
		test('should process SQS FIFO event', async () => {
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

			await expect(handler(sqsFifoEvent)).rejects.toThrow(`SQS FIFO Batch Failure: 2 of 3 failed`);
			expect(mock.processSqsFifo).toBeCalledTimes(2);
			expect(mock.processSqsFifo).toHaveBeenCalledWith(sqsFifoEvent.Records[0]);
			expect(mock.processSqsFifo).toHaveBeenCalledWith(sqsFifoEvent.Records[1]);
			expect(sqsDeleteMessageBatch).toHaveBeenCalledWith(sqsFifoArn, [
				{
					Id: sqsFifoEvent.Records[0].messageId,
					ReceiptHandle: sqsFifoEvent.Records[0].receiptHandle
				}
			]);

			const fns = Object.entries(mock)
				.filter(([key]) => key !== 'processSqsFifo')
				.map(([, value]) => value);

			fns.forEach((fn) => {
				expect(fn).not.toHaveBeenCalled();
			});
		});
	});

	describe('msk()', () => {
		test('should process MSK event', async () => {
			const mskEvent: MSKEvent = {
				eventSource: 'aws:kafka',
				eventSourceArn: mskArn,
				records: {
					'msk-topic-0': [
						{
							topic: mskTopic,
							partition: 0,
							offset: 0,
							timestamp: 1234567890123,
							timestampType: 'CREATE_TIME',
							value: 'Hello from MSK!',
							key: '',
							headers: []
						},
						{
							topic: mskTopic,
							partition: 0,
							offset: 1,
							timestamp: 1234567890123,
							timestampType: 'CREATE_TIME',
							value: 'Hello from MSK!',
							key: '',
							headers: []
						}
					]
				}
			};

			await handler(mskEvent);
			expect(mock.processMsk).toBeCalledTimes(2);
			expect(mock.processMsk).toHaveBeenCalledWith(mskEvent.records['msk-topic-0'][0]);
			expect(mock.processMsk).toHaveBeenCalledWith(mskEvent.records['msk-topic-0'][1]);

			const fns = Object.entries(mock)
				.filter(([key]) => key !== 'processMsk')
				.map(([, value]) => value);

			fns.forEach((fn) => {
				expect(fn).not.toHaveBeenCalled();
			});
		});
	});
});
