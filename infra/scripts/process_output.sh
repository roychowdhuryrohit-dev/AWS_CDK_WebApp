#!/bin/bash

QUERY_RES=$(aws dynamodb get-item --table-name $INPUT_TABLE_NAME --key '{"id":{"S":"'$ID'"}}')

INPUT_TEXT=$(echo $QUERY_RES | jq -r ".Item.input_text.S")
INPUT_FILE_PATH=$(echo $QUERY_RES | jq -r ".Item.input_file_path.S")

aws s3 cp s3://$INPUT_FILE_PATH input.txt

FILE_CONTENT=$(cat input.txt)
OUTPUT_FILE_NAME=$ID"_output.txt"

echo "$FILE_CONTENT : $INPUT_TEXT" | tee $OUTPUT_FILE_NAME

aws s3 cp $OUTPUT_FILE_NAME s3://$S3_BUCKET_NAME

aws dynamodb put-item --table-name $OUTPUT_TABLE_NAME --item '{"id":{"S":"'$ID'"},"output_file_path":{"S":"'$S3_BUCKET_NAME/$OUTPUT_FILE_NAME'"}}'