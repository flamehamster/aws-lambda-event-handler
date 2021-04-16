import { SNSEvent, SNSMessage, SQSEvent, SQSRecord, EventBridgeEvent } from 'aws-lambda';
// eslint-disable-next-line import/no-extraneous-dependencies
import SQS from 'aws-sdk/clients/sqs';

export type LambdaEvent = SNSEvent | SQSEvent | EventBridgeEvent<string, Record<string, unknown>>;

export default class Lambda {
	private readonly fns: ((event: LambdaEvent) => Promise<void>)[];

	constructor() {
		this.fns = [];
	}

	sns = (topicArn: string, processSnsMessage: (message: SNSMessage) => Promise<void>): void => {
		const fn = async (event: SNSEvent) => {
			if (!Array.isArray(event.Records)) return;

			// SNS only sends 1 record when processed by lambda
			// https://docs.aws.amazon.com/lambda/latest/dg/with-sns-create-package.html
			const record = event.Records[0];
			if (record.EventSource === 'aws:sns' && record.Sns.TopicArn === topicArn) {
				await processSnsMessage(record.Sns);
			}
		};
		this.fns.push(fn);
	};

	sqs = (queueArn: string, processSqsRecord: (record: SQSRecord) => Promise<void>): void => {
		const fn = async (event: SQSEvent) => {
			if (!Array.isArray(event.Records)) return;

			const records = event.Records.filter(
				(record) => record.eventSource === 'aws:sqs' && record.eventSourceARN === queueArn
			);

			const fulfilledRecords: SQS.DeleteMessageBatchRequestEntry[] = [];
			const errors: unknown[] = [];

			await Promise.all(
				records.map((record) =>
					processSqsRecord(record)
						.then(() => {
							fulfilledRecords.push({
								Id: record.messageId,
								ReceiptHandle: record.receiptHandle
							});
						})
						.catch((err) => {
							errors.push(err);
						})
				)
			);

			if (errors.length) {
				// if error(s), delete fulfilled record(s)
				// throw error to retry failed record(s)
				if (fulfilledRecords.length) {
					await this.sqsDeleteMessageBatch(queueArn, fulfilledRecords);
				}

				errors.forEach((err) => {
					console.error(err);
				});

				throw new Error(`SQS Batch Failure: ${fulfilledRecords.length} of ${records.length} succeeded`);
			}
		};
		this.fns.push(fn);
	};

	sqsFifo = (queueArn: string, processSqsRecord: (record: SQSRecord) => Promise<void>): void => {
		const fn = async (event: SQSEvent) => {
			if (!Array.isArray(event.Records)) return;

			const records = event.Records.filter(
				(record) => record.eventSource === 'aws:sqs' && record.eventSourceARN === queueArn
			);

			const fulfilledRecords: SQS.DeleteMessageBatchRequestEntry[] = [];

			try {
				// need to do sequentially to support FIFO
				// eslint-disable-next-line no-restricted-syntax
				for (const record of records) {
					// eslint-disable-next-line no-await-in-loop
					await processSqsRecord(record);
					fulfilledRecords.push({
						Id: record.messageId,
						ReceiptHandle: record.receiptHandle
					});
				}
			} catch (err) {
				// catch error and delete fulfilled record(s)
				// throw error to retry failed record(s)
				if (fulfilledRecords.length) {
					await this.sqsDeleteMessageBatch(queueArn, fulfilledRecords);
				}

				try {
					throw err;
				} finally {
					console.error(`SQS FIFO Batch Failure: ${fulfilledRecords.length} of ${records.length} succeeded`);
				}
			}
		};
		this.fns.push(fn);
	};

	eventBridge = (ruleArn: string, processEventBridge: () => Promise<void>): void => {
		const fn = async (event: EventBridgeEvent<string, Record<string, unknown>>) => {
			if (event.source === 'aws.events' && event.resources.includes(ruleArn)) {
				await processEventBridge();
			}
		};
		this.fns.push(fn);
	};

	handler = async (event: LambdaEvent): Promise<void> => {
		await Promise.all(this.fns.map((fn) => fn(event)));
	};

	sqsDeleteMessageBatch = async (
		queueArn: string,
		fulfilledRecords: SQS.DeleteMessageBatchRequestEntry[]
	): Promise<void> => {
		const [, , , region, awsAccountId, queueName] = queueArn.split(':');
		const sqs = new SQS({ region });
		const result = await sqs
			.getQueueUrl({
				QueueName: queueName,
				QueueOwnerAWSAccountId: awsAccountId
			})
			.promise();

		await sqs.deleteMessageBatch({
			QueueUrl: result.QueueUrl,
			Entries: fulfilledRecords
		});
	};
}
