
var AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1', });

const fromAddress = 'suthagar.14@cse.mrt.ac.lk'
const reportTemplateName = 'SampleTemplate_1'

async function createEmailTemplate() {  
    // Sample Email Template
    const params = {
      "Template": {
        "TemplateName": reportTemplateName,
        "SubjectPart": "Greetings, {{name}}!",
        "HtmlPart": "<h1>Hello {{name}},</h1><p>Your favorite animal is {{favoriteanimal}}.</p>",
        "TextPart": "Dear {{name}},\r\nYour favorite animal is {{favoriteanimal}}."
      }
    }
  
    return new Promise(resolve, reject => {
      ses.createTemplate(params, (err, data) => {
        if (err) {
          console.error(
            `CreateEmailTemplate: Email Template creation error : ${err}`
          );
          return reject(err)
        }
        console.info(
          'CreateEmailTemplate: Email Template creation completed! - ',
          data
        );
        return resolve('SES Email Template creation completed!')
      });
    });
}
  
async function sendReportEmail(toAddresses) {
    fs.readFile('./credencials.json', async function(err, data){
        if (err) {
            console.log("sendReportEmail: err : ", err)
            return err
        }
        else {
            data = JSON.parse(data)
            let tempCredentials = new AWS.Credentials(data.Credentials.AccessKeyId, 
                data.Credentials.SecretAccessKey, 
                data.Credentials.SessionToken)

            const ses = new AWS.SES({apiVersion: '2017-11-27', credentials:tempCredentials});
            
            const templateData = {
                "name" : "suthagar",
                "favoriteanimal": "Dog"
            }
            const emailParams = {
                Destination: {
                  CcAddresses: [],
                  ToAddresses: toAddresses
                },
                Source: fromAddress,
                Template: reportTemplateName,
                TemplateData: templateData,
                ReplyToAddresses: fromAddress
              };

              console.log("sendReportEmail: Start sending email")
            
              return new Promise(resolve, reject => {
                ses.sendTemplatedEmail(emailParams, (err, data) => {
                  if (err) {
                    console.error(
                      `sendEmailUsingTemplate: Email dispatch failed for emailAddress ${toAddresses}. Error ${JSON.stringify(
                        err
                      )}`
                    );
                    return reject(err);
                  }
                  console.info(
                    `sendEmailUsingTemplate: Email sent to ${toAddresses} - `,
                    data
                  );
                  return resolve(`Emails have sent successfully`);
                });
              });
           
        }
    })
}