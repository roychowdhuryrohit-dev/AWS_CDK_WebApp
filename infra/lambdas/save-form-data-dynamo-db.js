const { DynamoDB } = require("@aws-sdk/client-dynamodb");
const { PutCommand, DynamoDBDocument } = require("@aws-sdk/lib-dynamodb");

const DynamoDBClient = new DynamoDB({
    region: process.env.AWS_REGION,
})

const DynamoDBDocumentClient = DynamoDBDocument.from(DynamoDBClient);

exports.handler = async (event, context) => {
    let res = {
        'statusCode': 500,
        'headers': {
            'Access-Control-Allow-Origin': process.env.HOST_URL,
            'Access-Control-Allow-Methods': 'OPTIONS,POST'
        },
        'body': '',
    };

    if (event.body && event.body !== "") {
        try {
            let body = JSON.parse(event.body);
            if (body.id && body.id !== "" && body.input_text) {
                const putCommand = new PutCommand({
                    TableName: process.env.INPUT_TABLE_NAME,
                    Item: {
                        id: body.id,
                        input_text: body.input_text,
                        input_file_path: `${process.env.S3_BUCKET_NAME}/${body.id}.txt`
                    },
                });

                const dbRes = await DynamoDBDocumentClient.send(putCommand);
                console.log(dbRes);
                res.statusCode = 200;
            }
        } catch (e) {
            console.log(e);
        }
    }
    console.log(res);
    return res;
};

