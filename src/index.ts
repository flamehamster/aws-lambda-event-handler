import { SNSEvent, SNSMessage, SQSEvent, SQSRecord, MSKEvent, MSKRecord, EventBridgeEvent } from 'aws-lambda';
import { SQSClient, DeleteMessageBatchRequestEntry, DeleteMessageBatchCommand } from '@aws-sdk/client-sqs';

type LambdaEvent = SNSEvent | SQSEvent | MSKEvent | EventBridgeEvent<string, Record<string, unknown>>;

export class Lambda {
	private readonly fns: ((event: LambdaEvent) => Promise<unknown>)[];

	constructor() {
		this.fns = [];
	}

	sns = (topicArn: string, processSnsMessage: (message: SNSMessage) => Promise<void>): void => {
		const fn = async (event: SNSEvent) => {
			if (!Array.isArray(event.Records)) return;

			const record = event.Records[0];
			if (record.EventSource !== 'aws:sns' || record.Sns.TopicArn !== topicArn) return;

			await processSnsMessage(record.Sns);
		};
		this.fns.push(fn);
	};

	sqs = (queueArn: string, processSqsRecord: (record: SQSRecord) => Promise<void>): void => {
		const fn = async (event: SQSEvent) => {
			if (!Array.isArray(event.Records)) return;

			const records = event.Records;
			if (records[0].eventSource !== 'aws:sqs' || records[0].eventSourceARN !== queueArn) return;

			const fulfilledRecords: DeleteMessageBatchRequestEntry[] = [];
			const errors: Error[] = [];

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
				if (fulfilledRecords.length) {
					await this.sqsDeleteMessageBatch(queueArn, fulfilledRecords);
				}

				errors.forEach((err) => {
					console.error(err);
				});
				throw new Error(`SQS Batch Failure: ${errors.length} of ${records.length} failed`);
			}
		};
		this.fns.push(fn);
	};

	sqsFifo = (queueArn: string, processSqsRecord: (record: SQSRecord) => Promise<void>): void => {
		const fn = async (event: SQSEvent) => {
			if (!Array.isArray(event.Records)) return;

			const records = event.Records;
			if (records[0].eventSource !== 'aws:sqs' || records[0].eventSourceARN !== queueArn) return;

			const fulfilledRecords: DeleteMessageBatchRequestEntry[] = [];

			try {
				for (const record of records) {
					await processSqsRecord(record);
					fulfilledRecords.push({
						Id: record.messageId,
						ReceiptHandle: record.receiptHandle
					});
				}
			} catch (err) {
				// catch error and delete fulfilled record(s)
				// throw error to retry failed and remaining record(s)
				if (fulfilledRecords.length) {
					await this.sqsDeleteMessageBatch(queueArn, fulfilledRecords);
				}

				console.error(err);
				const failedRecordsCount = records.length - fulfilledRecords.length;
				throw new Error(`SQS FIFO Batch Failure: ${failedRecordsCount} of ${records.length} failed`);
			}
		};
		this.fns.push(fn);
	};

	msk = (mskArn: string, mskTopic: string, processMskRecord: (record: MSKRecord) => Promise<void>): void => {
		const fn = async (event: MSKEvent) => {
			if (event.eventSource !== 'aws:kafka' || event.eventSourceArn !== mskArn) return;
			if (!(event.records instanceof Object) || Array.isArray(event.records)) return;

			const records: MSKRecord[] = [];
			for (const [, mskRecords] of Object.entries(event.records)) {
				mskRecords.forEach((mskRecord) => {
					if (mskRecord.topic === mskTopic) {
						records.push(mskRecord);
					}
				});
			}

			for (const record of records) {
				await processMskRecord(record);
			}
		};
		this.fns.push(fn);
	};

	scheduledEvent = (ruleArn: string, processScheduledEvent: () => Promise<void>): void => {
		const fn = async (event: EventBridgeEvent<'Scheduled Event', Record<string, never>>) => {
			if (event.source !== 'aws.events' || !event.resources.includes(ruleArn)) return;
			await processScheduledEvent();
		};
		this.fns.push(fn);
	};

	eventBridge = (resourceArn: string, processEventBridge: (detail: Record<string, unknown>) => Promise<void>): void => {
		const fn = async (event: EventBridgeEvent<string, Record<string, unknown>>) => {
			if (!Array.isArray(event.resources) || !event.resources.includes(resourceArn)) return;
			await processEventBridge(event.detail);
		};
		this.fns.push(fn);
	};

	handler = async (event: LambdaEvent): Promise<unknown> => {
		for (const fn of this.fns) {
			const result = await fn(event);
			if (result) {
				return result;
			}
		}
	};

	sqsDeleteMessageBatch = async (
		queueArn: string,
		fulfilledRecords: DeleteMessageBatchRequestEntry[]
	): Promise<void> => {
		const [, , , region, awsAccountId, queueName] = queueArn.split(':');
		const queueUrl = `https://sqs.${region}.amazonaws.com/${awsAccountId}/${queueName}`;
		const sqs = new SQSClient({ region });

		const command = new DeleteMessageBatchCommand({
			QueueUrl: queueUrl,
			Entries: fulfilledRecords
		});

		await sqs.send(command);
	};
}
