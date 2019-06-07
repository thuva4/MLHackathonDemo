var express = require('express');
var router = express.Router();
var AWS = require('aws-sdk');
const axios = require('axios');
const fs = require('fs');

AWS.config.update({region: 'us-east-1'});
/* GET home page. */
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
  res.send({
    'products': []
  });
});

router.get('/reviews', function(req, res, next){
  res.send({
    'fileList': []
  });
});

router.post('/reviews', function(req, res, next){
  fs.readFile('./credencials.json', function(err, data){
    if (err) res.status(500).send(err)
    else {
        data = JSON.parse(data)
        let tempCredentials = new AWS.Credentials(data.Credentials.AccessKeyId, 
            data.Credentials.SecretAccessKey, 
            data.Credentials.SessionToken)
        const comprehend = new AWS.Comprehend({apiVersion: '2017-11-27', credentials:tempCredentials});
        const params = {
              "LanguageCode": "en",
              "TextList": [ ...req.body.reviews ]
           }
        const finalData = {
          sentiment: [],
          keyPhrases: []
        }
        let sentimet = await comprehend.batchDetectSentiment(params, function (err, data) {
              if (err) res.status(400).send({ 'error': err}); 
              else return data          
            });
        let keyPhrases = await comprehend.batchDetectKeyPhrases(params, function (err, data) {
          if (err) res.status(400).send({ 'error': err}); 
          else return data;           
        });
        console.log(keyPhrases.json())
        console.log(sentimet.json())
        res.send(finalData)
    }
})
});

module.exports = router;
