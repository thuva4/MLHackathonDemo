var express = require('express');
var router = express.Router();
var AWS = require('aws-sdk');
const axios = require('axios');
const fs = require('fs');
const inputProducts = require('../data/inputProducts').products
const inputProductsIngredients = require('../data/produts').products
const { sendEmail } = require('../service/emailService')
AWS.config.update({region: 'us-east-1'});
/* GET home page. */

const reviweFileNames = [
  "positive5",
"positive10",
"positive20",
"neutral5",
"neutral10",
"neutral20",
"negative5",
"negative10",
"negative20"
]
const productsNames = [
  'SPICY CHICKEN PIZZA',
'BBQ CHICKEN PIZZA',
'ICE CREAM SANDWICHES',
'PUMPKIN CHEESECAKE',
'BLUEBERRY MUFFINS',
'MILK CHOCOLATE FLAKES',
'BROWNIES',
'JELLY',
'HONEY HAM',
'TURKEY',
'BEEF PATTIES',
'GELATO',
'PORK RUB',
'BROCCOLI CUTS',
'SHERBET',
'SHRIMP',
'COOKIE',
'COFFEE',
'CUPCAKES']
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
    'fileList': reviweFileNames
  });
});

router.post('/reviews', async (req, res, next) => {
  const responseJson = {}
  await fs.readFile('./credencials.json', async (err, data) => {
    if (err) console.log(err)
    else {
        data = JSON.parse(data)
        let tempCredentials = new AWS.Credentials(data.Credentials.AccessKeyId, 
            data.Credentials.SecretAccessKey, 
            data.Credentials.SessionToken)
        const comprehend = new AWS.Comprehend({apiVersion: '2017-11-27', credentials:tempCredentials});
        res.send({
          "message": "Received"
        })
        const length = req.body.info.length
        let i = 0
        for (const reviewDetails of req.body.info) {
            await fs.readFile(`./reviews/${reviweFileNames[reviewDetails.reviewId]}.json`, async function(err, reviews){
              if (err) console.log(err)
              else {
                reviewsJson = JSON.parse(reviews)
                console.log(reviewsJson)
                  const params = {
                    "LanguageCode": "en",
                    "TextList": [ ...reviewsJson.reviews ]
                  }
                  console.log(params)
                  let sentimet = await new Promise( (resolve, reject)=> {
                    comprehend.batchDetectSentiment(params, function (err, data) {
                        if (err) reject(err)
                        else return resolve(data)          
                      });
                    }
                  );
                  // let keyPhrases = await new Promise( (resolve, reject)=> {
                  //   comprehend.batchDetectKeyPhrases(params, function (err, data) {
                  //     if (err) reject(err) 
                  //     else return resolve(data);           
                  //   });
                  // });
                  responseJson[productsNames[reviewDetails.productId]] = {sentimet}
                  console.log(i, length)
                  if(i==length-1){
                    let conmpanyRating = 0
                    let overallCount = 0
                    const productDetails  = []
                    for (const reviewDetailsInner of req.body.info) {
                        const sentiments = responseJson[productsNames[reviewDetailsInner.productId]].sentimet.ResultList[0]
                        const productRating = (10 * sentiments.SentimentScore.Positive + 5 * sentiments.SentimentScore.Neutral + 5 * sentiments.SentimentScore.Mixed)/20
                        const productCount = responseJson[productsNames[reviewDetailsInner.productId]].sentimet.ResultList.length
                        conmpanyRating += productRating
                        overallCount += productCount
                        const productDetail = {
                          name: productsNames[reviewDetailsInner.productId],
                          rating: productRating,
                          counts: productCount,
                          ingredientsSort: []
                        }
                        for (const inputProductsIngredient of inputProductsIngredients) {
                          if(inputProductsIngredient.name==productsNames[reviewDetailsInner.productId]){
                            inputProductsIngredient.ingredients.sort(function(a,b){
                              return a.confident < b.confident ? 1 : -1;
                            });
                            const maxLe = Math.min(5, inputProductsIngredient.ingredients.length)
                            productDetail.ingredientsSort = inputProductsIngredient.ingredients.slice(0,maxLe)
                            console.log(productDetail)
                          }
                        }
                        productDetails.push(productDetail)
                   
                      }

                    console.log({ conmpanyRating: conmpanyRating/overallCount, overallCount, productDetails})

                    // const response = { conmpanyRating: conmpanyRating/overallCount, overallCount, productDetails}

                    const htmlDATA = `<h1> Company Name : Sample Company </h1> <br/> 
                        <h2> Company Ratings : ${conmpanyRating/overallCount} </h2> <br/> <br/>`
                    
                    let productsInfo = ''
                    console.log(productDetails)
                    productDetails.forEach(product => {
                      let productData = `<h3> Product Name : ${product.name} </h3> 
                    <ul> 
                      <li> Rating : ${product.rating}</li>
                      <li> Hot selling count : ${product.count} </li>
                      <li> Ingredients </li>
                      <ul> 
                         {{INCREDIENTDATA}}
                      </ul>
                    </ul>`

                      let incredientData = ''
                      console.log(product.ingredientsSort)
                      product.ingredientsSort.forEach(incredient => {
                        incredientData += ` <li> Name: ${incredient.name}</li>
                        <li> Importance: ${incredient.confident} </li>`
                      })
                      productData = productData.replace(`{{INCREDIENTDATA}}`, incredientData)

                      productsInfo += productData
                    });
                    
                    htmlDATA += productsInfo

                    // await sendEmail('suthagar.14@cse.mrt.ac.lk', JSON.stringify({ conmpanyRating: conmpanyRating/overallCount, overallCount, productDetails}))
                    await sendEmail('suthagar.14@cse.mrt.ac.lk', htmlDATA)
                  }
                  i++;
                  
                }
              });
        }
      
    }
})
});

module.exports = router;
