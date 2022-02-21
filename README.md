
# aws-lambda-handler

[![npm package](https://img.shields.io/npm/v/aws-lambda-handler.svg)](http://npmjs.org/package/aws-lambda-handler)
![npm license](https://img.shields.io/npm/l/aws-lambda-handler)
![Snyk Vulnerabilities for npm package](https://img.shields.io/snyk/vulnerabilities/npm/aws-lambda-handler)
Instead of using one Lambda function for each event, we can add multiple event triggers to a single Lambda function.
`aws-lambda-handler` allows us to manage multiple events in one Lambda function easily.

## Introduction

```typescript
lambda.sns(topicArn: string, processSnsMessage: (message: SNSMessage) => Promise<void>): void
```
* `processSnsMessage` is an `async` function that takes in [SNSMessage](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/aws-lambda/trigger/sns.d.ts#L15-L27).

```typescript
lambda.sqs(queueArn: string, processSqsRecord: (record: SQSRecord) => Promise<void>): void
```
* `processSqsRecord` is an `async` function that takes in [SQSRecord](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/aws-lambda/trigger/sqs.d.ts#L8-L18).
* Records in a batch are processed concurrently by `processSqsRecord` function.
* Records processed successfully are removed from the queue.
* Records processed unsuccessfully will remain in the queue.
* Additional permissions `sqs:GetQueueUrl` and `sqs:GetQueueUrl` are needed.

```typescript
lambda.sqsFifo(queueArn: string, processSqsRecord: (record: SQSRecord) => Promise<void>): void
```
* `processSqsRecord` is an `async` function that takes in [SQSRecord](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/aws-lambda/trigger/sqs.d.ts#L8-L18).
* Records in a batch are processed in sequence by `processSqsRecord` function.
* Records processed successfully are removed from the queue.
* When a record is processed unsuccessfully, subsequent records will remain in the queue.
* Additional permissions `sqs:GetQueueUrl` and `sqs:GetQueueUrl` are needed.


```typescript
lambda.scheduledEvent(ruleArn: string, processScheduledEvent: () => Promise<void>): void
```
* `processScheduledEvent` is an `async` function that processes `EventBridge` (`CloudWatch Events`) scheduled message event.
* More information [here](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-run-lambda-schedule.html).

## Installation

### JavaScript

```bash
$ npm i aws-lambda-handler
```

### TypeScript

```bash
$ npm i aws-lambda-handler
$ npm i --save-dev @types/aws-lambda
```

## Usage

### JavaScript

```javascript
const Lambda = require('aws-lambda-handler');

const lambda = new Lambda();

const processScheduledEvent = () => {
	try {
		// do something...
	} catch (err) {
		// log error in cloudwatch
		console.error(err);
	}
};
lambda.scheduledEvent('<RULE_ARN>', processScheduledEvent);

const processSqsRecord = (record) => {
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

const processSnsMessage = (message) => {
	try {
		const jsonObject = JSON.parse(message.Message);
		// do something...
	} catch (err) {
		// console.error(err); log error in cloudwatch to mark as successfully
		// throw err; throw error to mark as unsuccessfully
	}
};
lambda.sns('<TOPIC_ARN>', processSnsMessage);

exports.handler = lambda.handler;
```

### TypeScript

```typescript
import Lambda from 'aws-lambda-handler';
import { SQSRecord, SNSMessage } from 'aws-lambda';

const lambda = new Lambda();

const processScheduledEvent = () => {
	try {
		// do something...
	} catch (err) {
		// log error in cloudwatch
		console.error(err);
	}
};
lambda.scheduledEvent('<RULE_ARN>', processScheduledEvent);

const processSqsRecord = (record: SQSRecord) => {
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

const processSnsMessage = (message: SNSMessage) => {
	try {
		const jsonObject = JSON.parse(message.Message);
		// do something...
	} catch (err) {
		// console.error(err); log error in cloudwatch to mark as successfully
		// throw err; throw error to mark as unsuccessfully
	}
};
lambda.sns('<TOPIC_ARN>', processSnsMessage);

const handler = lambda.handler;

export { handler };
```
