import React, { useState } from "react";
import './App.css';
import axios from 'axios';

function App() {
  const [inputFile, setInputFile] = useState(null);
  const [inputText, setInputText] = useState("");
  const GEN_S3_URL_API_ENDPOINT = process.env.REACT_APP_GEN_S3_URL_API_ENDPOINT;
  const SAVE_FORM_DYNAMO_DB_API_ENDPOINT = process.env.REACT_APP_SAVE_FORM_DYNAMO_DB_API_ENDPOINT;

  const handleInputText = (event) => {
    setInputText(event.target.value);
  };
  const handleInputFile = (event) => {
    setInputFile(event.target.files[0]);
  };


  const genS3Url = async () => {
    const response = await axios({
      method: "GET",
      url: GEN_S3_URL_API_ENDPOINT,
    });
    return response.data;
  };

  const uploadToS3 = async (S3UploadUrl) => {
    await axios.put(S3UploadUrl, inputFile, {
      headers: {
        "Content-Type": "text/plain",
      },
    });
    // console.log(uploadRes);
  };

  const writeToDynamoDb = async (id) => {
    const response = await axios.post(SAVE_FORM_DYNAMO_DB_API_ENDPOINT, {
      id: id,
      input_text: inputText
    });
    return response.data;
  };

  const onSubmit = async () => {
    try {
      if (!inputFile) {
        alert("Input a file!");
        return;
      }
      const genS3UrlRes = await genS3Url();
      // console.log(genS3UrlRes);
      await uploadToS3(genS3UrlRes.presignedUrl);
      await writeToDynamoDb(genS3UrlRes.id);
      // console.log(saveFormDynamoDbRes);
      alert("Upload successful!")
      window.location.reload()
    } catch (error) {
      alert("Failed to upload!");
      console.error(error);
    }
  };

  return (

    <div className="overflow-hidden absolute h-screen w-screen justify-center flex items-start">
      <form className="flex flex-col flex-wrap content-center text-white bg-black mt-20 w-auto gap-3 shadow-lg shadow-black rounded-lg">
        <h1 className="text-3xl font-bold dark:text-white m-3">Fovus Coding Challenge</h1>
        <label className="ml-3 mb-3">Text input:
          <input className="ml-1 text-white bg-black border border-white rounded outline-none" id="inputTextField" type="text" value={inputText} onChange={handleInputText} />
        </label>
        <label className="ml-3 mb-3 ">File input:
          <input className="ml-2 file:text-white file:bg-black file:border file:border-white file:rounded text-sm w-48" id="inputFileField" type="file" accept="text/plain" onChange={handleInputFile} />
        </label>
        <button className="w-16 border border-white rounded ml-3 mb-5" onClick={onSubmit} type="button">Submit</button>
      </form>
    </div>

  );
}

export default App;
