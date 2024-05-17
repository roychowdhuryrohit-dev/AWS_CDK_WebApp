const { nanoid } = require('nanoid');

const { S3, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const S3Client = new S3({
    region: process.env.AWS_REGION
});

exports.handler = async (event, context) => {
    const ID = nanoid();
    const KEY = `${ID}.txt`;

    const putCommand = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: KEY,
        ContentType: 'text/plain',
    });

    try {
        const presignedUrl = await getSignedUrl(S3Client, putCommand, {
            expiresIn: 60
        })
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': process.env.HOST_URL,
                "Access-Control-Allow-Methods": 'OPTIONS,GET'
            },
            'body': JSON.stringify({
                'presignedUrl': presignedUrl,
                'id': ID,
            }),
        }
    } catch (e) {
        console.log(e);
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': process.env.HOST_URL,
                "Access-Control-Allow-Methods": 'OPTIONS,GET'
            },
            'body': {},
        }
    }
};