# aws-lambda-event-handler

[![npm package](https://img.shields.io/npm/v/aws-lambda-event-handler.svg)](http://npmjs.org/package/aws-lambda-event-handler)
![npm license](https://img.shields.io/npm/l/aws-lambda-event-handler)

Instead of using one Lambda function for each event, we can add multiple event triggers to a single Lambda function.
`aws-lambda-event-handler` allows us to manage multiple events in one Lambda function easily.

## Introduction

```typescript
lambda.sns(topicArn: string, processSnsMessage: (message: SNSMessage) => Promise<void>): void
```
* `processSnsMessage` is an `async` function that takes in [SNSMessage](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/aws-lambda/trigger/sns.d.ts#L15-L27).

```typescript
lambda.sqs(queueArn: string, processSqsRecord: (record: SQSRecord) => Promise<void>): void
```
* `processSqsRecord` is an `async` function that takes in [SQSRecord](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/aws-lambda/trigger/sqs.d.ts#L8-L18).
* Records in a batch are processed `concurrently` by `processSqsRecord` function.
* Records processed successfully are removed from the queue.
* Records processed unsuccessfully will remain in the queue.
* Additional permission `sqs:DeleteMessage` is needed.

```typescript
lambda.sqsFifo(queueArn: string, processSqsRecord: (record: SQSRecord) => Promise<void>): void
```
* `processSqsRecord` is an `async` function that takes in [SQSRecord](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/aws-lambda/trigger/sqs.d.ts#L8-L18).
* Records in a batch are processed `sequentially` by `processSqsRecord` function.
* Records processed successfully are removed from the queue.
* When a record is processed unsuccessfully, subsequent records will remain in the queue.
* Additional permission `sqs:DeleteMessage` is needed.

```typescript
lambda.msk(mskArn: string, mskTopic: string, processMskRecord: (record: MSKRecord) => Promise<void>): void
```
* `processMskRecord` is an `async` function that takes in [MSKRecord](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/aws-lambda/trigger/msk.d.ts#L5-L13).
* Records in a batch are processed `sequentially` by `processMskRecord` function.
* After Lambda processes each batch, it commits the offsets of the records in that batch.
* If `processMskRecord` returns an error for any of the records in a batch, Lambda retries the entire batch of records.

```typescript
lambda.scheduledEvent(ruleArn: string, processScheduledEvent: () => Promise<void>): void
```
* `processScheduledEvent` is an `async` function that processes `EventBridge` (`CloudWatch Events`) scheduled message event.
* More information [here](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-run-lambda-schedule.html).

## Installation

Note: AWS Lambda Node.js runtime has AWS SDK for JavaScript v2.1001.0.

### JavaScript

```bash
$ npm i aws-lambda-event-handler
```

### TypeScript

```bash
$ npm i aws-lambda-event-handler
$ npm i -D aws-sdk@2.1001.0
$ npm i -D @types/aws-lambda
```

## Usage

### JavaScript

```javascript
const { Lambda } = require('aws-lambda-event-handler');

const lambda = new Lambda();

const processScheduledEvent = async () => {
	try {
		// do something...
	} catch (err) {
		// log error in cloudwatch
		console.error(err);
	}
};
lambda.scheduledEvent('<RULE_ARN>', processScheduledEvent);

const processSqsRecord = async (record) => {
	try {
		const jsonObject = JSON.parse(record.body);
		// do something...
	} catch (err) {
		// console.error(err); log error in cloudwatch to mark as successful
		// throw err; throw error to mark as unsuccessful
	}
};
lambda.sqs('<SQS_ARN>', processSqsRecord);
lambda.sqsFifo('<SQS_FIFO_ARN>', processSqsRecord);

const processSnsMessage = async (message) => {
	try {
		const jsonObject = JSON.parse(message.Message);
		// do something...
	} catch (err) {
		// console.error(err); log error in cloudwatch
		// throw err; throw error to trigger retry, if configured
	}
};
lambda.sns('<TOPIC_ARN>', processSnsMessage);

const processMskRecord = async (record) => {
	try {
		const value = Buffer.from(record.value, 'base64').toString();
		const jsonObject = JSON.parse(value);
		// do something...
	} catch (err) {
		// console.error(err); log error in cloudwatch
		// throw err; throw error to trigger retry, if configured
	}
};
lambda.msk('<MSK_ARN>', '<MSK_TOPIC>', processMskRecord);

exports.handler = lambda.handler;
```

### TypeScript

```typescript
import { Lambda } from 'aws-lambda-event-handler';
import { SQSRecord, SNSMessage, MSKRecord } from 'aws-lambda';

const lambda = new Lambda();

const processScheduledEvent = async (): Promise<void> => {
	try {
		// do something...
	} catch (err) {
		// log error in cloudwatch
		console.error(err);
	}
};
lambda.scheduledEvent('<RULE_ARN>', processScheduledEvent);

const processSqsRecord = async (record: SQSRecord): Promise<void> => {
	try {
		const jsonObject = JSON.parse(record.body);
		// do something...
	} catch (err) {
		// console.error(err); log error in cloudwatch to mark as successful
		// throw err; throw error to mark as unsuccessful
	}
};
lambda.sqs('<SQS_ARN>', processSqsRecord);
lambda.sqsFifo('<SQS_FIFO_ARN>', processSqsRecord);

const processSnsMessage = async (message: SNSMessage): Promise<void> => {
	try {
		const jsonObject = JSON.parse(message.Message);
		// do something...
	} catch (err) {
		// console.error(err); log error in cloudwatch
		// throw err; throw error to trigger retry, if configured
	}
};
lambda.sns('<TOPIC_ARN>', processSnsMessage);

const processMskRecord = async (record: MSKRecord): Promise<void> => {
	try {
		const value = Buffer.from(record.value, 'base64').toString();
		const jsonObject = JSON.parse(value);
		// do something...
	} catch (err) {
		// console.error(err); log error in cloudwatch
		// throw err; throw error to trigger retry, if configured
	}
};
lambda.msk('<MSK_ARN>', '<MSK_TOPIC>', processMskRecord);

const handler = lambda.handler;

export { handler };
```
