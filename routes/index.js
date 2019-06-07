var express = require('express');
var router = express.Router();
var AWS = require('aws-sdk');
const axios = require('axios');
const fs = require('fs');
const inputProducts = require('../data/inputProducts').products
AWS.config.update({region: 'us-east-1'});
/* GET home page. */

const reviweFileNames = ["negative", "positive"]
const productsNames = ["Burger", "Cheese"]
router.get('/', async function(req, res, next) {
  let roleArn =await axios.get("http://169.254.169.254/latest/meta-data/iam/info")	    
  .then(response => response.data)	     
  .then(data => {
    console.log(data)	      
   return data.InstanceProfileArn.replace("instance-profile", "role");
})
  console.log("Assuming role: "+roleArn);
  let sts = new AWS.STS() ;
  sts.assumeRole({RoleArn: roleArn, RoleSessionName: 'comprehend'}, function(err, data) {
    if (err) res.status(500).send(err); // an error occurred
    else {           // successful response
        fs.writeFile('./credencials.json', JSON.stringify(data), function(err) {
            if(err) {
                return res.status(500).send(err);
            }
        }); 
        res.send(data.Credentials);
    }
  });
});


router.get('/products', function(req, res, next){
  res.send(inputProducts)
});

router.get('/reviews', function(req, res, next){
  res.send({
    'fileList': ['file1', 'file2', 'file3']
  });
});

router.post('/reviews', async function(req, res, next){
  const responseJson = {}
  fs.readFile('./credencials.json', async function(err, data){
    if (err) res.status(500).send(err)
    else {
        data = JSON.parse(data)
        let tempCredentials = new AWS.Credentials(data.Credentials.AccessKeyId, 
            data.Credentials.SecretAccessKey, 
            data.Credentials.SessionToken)
        const comprehend = new AWS.Comprehend({apiVersion: '2017-11-27', credentials:tempCredentials});
        for (const reviewDetails of req.body.info) {
          fs.readFile(`./reviews/${reviweFileNames[reviewDetails.reviewId]}.json`, async function(err, reviews){
            if (err) res.status(500).send(err)
            else {
                const params = {
                  "LanguageCode": "en",
                  "TextList": [ ...reviews.reviews ]
                }
                let sentimet = await new Promise( (resolve, reject)=> {
                  comprehend.batchDetectSentiment(params, function (err, data) {
                      if (err) reject(err)
                      else return resolve(data)          
                    });
                  }
                );
                let keyPhrases = await new Promise( (resolve, reject)=> {
                  comprehend.batchDetectKeyPhrases(params, function (err, data) {
                    if (err) reject(err) 
                    else return resolve(data);           
                  });
                });
                responseJson[productsNames[reviewDetails.productId]] = {sentimet, keyPhrases}
              }
            });
        }
        res.send(responseJson)
    }
})
});

module.exports = router;
