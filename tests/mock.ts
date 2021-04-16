import { SQSRecord } from 'aws-lambda';

export default {
	processEventBridge: jest.fn(),
	notProcessEventBridge: jest.fn(),
	processSns: jest.fn(),
	notProcessSns: jest.fn(),
	processSqs: jest.fn().mockImplementation(
		async (record: SQSRecord): Promise<void> => {
			if (record.body === 'FAILED') {
				throw new Error('SQS FAILED');
			}
		}
	),
	notProcessSqs: jest.fn(),
	processSqsFifo: jest.fn().mockImplementation(
		async (record: SQSRecord): Promise<void> => {
			if (record.body === 'FAILED') {
				throw new Error('SQS FAILED');
			}
		}
	),
	notProcessSqsFifo: jest.fn()
};
