import { Stack, StackProps, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Runtime, Architecture, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deployment from "aws-cdk-lib/aws-s3-deployment";
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';

import { join } from 'path';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';


export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "";
    const INPUT_TABLE_NAME = process.env.INPUT_TABLE_NAME || "";
    const OUTPUT_TABLE_NAME = process.env.OUTPUT_TABLE_NAME || "";
    const HOST_URL = process.env.HOST_URL || "";

    if (!S3_BUCKET_NAME) {
      throw new Error("S3_BUCKET_NAME not set!");
    }
    if (!INPUT_TABLE_NAME) {
      throw new Error("INPUT_TABLE_NAME not set!");
    }
    if (!OUTPUT_TABLE_NAME) {
      throw new Error("OUTPUT_TABLE_NAME not set!");
    }
    if (!HOST_URL) {
      throw new Error("HOST_URL not set!");
    }

    const genS3UrlFunc = new NodejsFunction(this, 'gen-presigned-url-s3', {
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      timeout: Duration.seconds(30),
      handler: 'handler',
      functionName: 'gen-presigned-url-s3',
      entry: join(__dirname, '../lambdas/generate-presigned-url-s3.js'),
      environment: {
        S3_BUCKET_NAME: S3_BUCKET_NAME,
        HOST_URL: HOST_URL,
      },
      bundling: {
        externalModules: ['@aws-sdk/client-s3'],
      }
    });

    const corsRule: s3.CorsRule = {
      allowedMethods: [s3.HttpMethods.PUT],
      allowedOrigins: [HOST_URL],
      allowedHeaders: ['*'],
      exposedHeaders: [],
    };

    const s3bucket = new s3.Bucket(this, S3_BUCKET_NAME, {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      bucketName: S3_BUCKET_NAME,
      cors: [corsRule],
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
    });

    s3bucket.grantReadWrite(genS3UrlFunc);

    const genS3UrlApiGateway = new apigateway.LambdaRestApi(this, 'gen-s3-url-api', {
      handler: genS3UrlFunc,
      proxy: false,
    });

    const genS3UrlApi = genS3UrlApiGateway.root.addResource('genS3Url');
    genS3UrlApi.addMethod('GET');

    genS3UrlApi.addCorsPreflight({
      allowOrigins: [HOST_URL],
      allowMethods: ['OPTIONS', 'GET'],
      allowHeaders: ['*'],
    })

    const userFormTable = new dynamodb.Table(this, INPUT_TABLE_NAME, {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
      tableName: INPUT_TABLE_NAME,
      stream: dynamodb.StreamViewType.KEYS_ONLY,
    });

    const saveFormDataDynamoDbFunc = new NodejsFunction(this, 'save-form-dynamo-db', {
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      timeout: Duration.seconds(30),
      handler: 'handler',
      functionName: 'save-form-dynamo-db',
      entry: join(__dirname, '../lambdas/save-form-data-dynamo-db.js'),
      environment: {
        S3_BUCKET_NAME: S3_BUCKET_NAME,
        INPUT_TABLE_NAME: INPUT_TABLE_NAME,
        HOST_URL: HOST_URL,
      },
      bundling: {
        externalModules: ['@aws-sdk/client-dynamodb', "@aws-sdk/lib-dynamodb"],
      }
    });

    const saveFormDataDynamoDbApiGateway = new apigateway.LambdaRestApi(this, 'save-form-dynamo-db-api', {
      handler: saveFormDataDynamoDbFunc,
      proxy: false,
    });

    const saveFormDataDynamoDbApi = saveFormDataDynamoDbApiGateway.root.addResource('saveFormDynamoDb');
    saveFormDataDynamoDbApi.addMethod('POST');

    saveFormDataDynamoDbApi.addCorsPreflight({
      allowOrigins: [HOST_URL],
      allowMethods: ['OPTIONS', 'POST'],
      allowHeaders: ['*'],
    });

    userFormTable.grantWriteData(saveFormDataDynamoDbFunc);

    new s3deployment.BucketDeployment(this, "upload-process-output-script", {
      sources: [s3deployment.Source.asset(join(__dirname, '../scripts'))],
      destinationBucket: s3bucket
    });

    const processStreamDynamoDbFunc = new NodejsFunction(this, 'process-stream-dynamo-db', {
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      timeout: Duration.seconds(120),
      handler: 'handler',
      functionName: 'process-stream-dynamo-db',
      entry: join(__dirname, '../lambdas/process-stream-dynamo-db.js'),
      environment: {
        S3_BUCKET_NAME: S3_BUCKET_NAME,
        INPUT_TABLE_NAME: INPUT_TABLE_NAME,
        OUTPUT_TABLE_NAME: OUTPUT_TABLE_NAME,
        PROCESS_OUTPUT_SCRIPT_FILENAME: 'process_output.sh'
      },
      bundling: {
        externalModules: ['@aws-sdk/client-dynamodb', "@aws-sdk/lib-dynamodb", "@aws-sdk/client-ec2"],
      }
    });
    userFormTable.grantReadData(processStreamDynamoDbFunc);
    s3bucket.grantReadWrite(processStreamDynamoDbFunc);

    processStreamDynamoDbFunc.addEventSource(
      new DynamoEventSource(userFormTable, {
        startingPosition: StartingPosition.LATEST,
      })
    );

    processStreamDynamoDbFunc.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ec2:RunInstances'],
      resources: ['*']
    }));

    const outputTable = new dynamodb.Table(this, OUTPUT_TABLE_NAME, {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
      tableName: OUTPUT_TABLE_NAME,
    });
    outputTable.grantWriteData(processStreamDynamoDbFunc);

  }
}
