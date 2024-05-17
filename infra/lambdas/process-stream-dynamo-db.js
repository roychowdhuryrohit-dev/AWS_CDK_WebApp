import { EC2Client, RunInstancesCommand } from "@aws-sdk/client-ec2";

const client = new EC2Client({ region: process.env.AWS_REGION });

exports.handler = async (event, context) => {
    let id = "";
    if (event.Records.length >= 0) {
        id = event.Records[0].dynamodb?.Keys?.id?.S
    }

    if (id) {
        const INIT_SCRIPT = `#!/bin/bash
export AWS_ACCESS_KEY_ID="${process.env.AWS_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${process.env.AWS_SECRET_ACCESS_KEY}"
export AWS_SESSION_TOKEN="${process.env.AWS_SESSION_TOKEN}"
export ID="${id}"
export INPUT_TABLE_NAME="${process.env.INPUT_TABLE_NAME}"
export OUTPUT_TABLE_NAME="${process.env.OUTPUT_TABLE_NAME}"
export S3_BUCKET_NAME="${process.env.S3_BUCKET_NAME}"

aws s3 cp s3://${process.env.S3_BUCKET_NAME}/${process.env.PROCESS_OUTPUT_SCRIPT_FILENAME} run.sh
chmod +x run.sh
./run.sh
sudo shutdown now
`;
        const runCommand = new RunInstancesCommand({
            ImageId: "ami-0ddda618e961f2270",
            InstanceType: "t2.micro",
            MaxCount: 1,
            MinCount: 1,
            InstanceInitiatedShutdownBehavior: "terminate",
            UserData: Buffer.from(INIT_SCRIPT).toString('base64'),
        });
        console.log(INIT_SCRIPT);
    
        try {
            const response = await client.send(runCommand);
            console.log(response);
        } catch (err) {
            console.error(err);
        }
    }

};