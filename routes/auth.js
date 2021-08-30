var express = require('express');
var router = express.Router();
var template = require('../lib/template.js');
var dbConnection = require('../db_info.js');
var axios = require('axios');
var dbconn = dbConnection.init();
var qs = require('qs');
const kakaoCredentials = require('../config/kakao.json');

module.exports = function(passport){
    router.get('/login', function(request, response){ 
        var title = 'login';
        var body = `
            <form action="/auth/login_process" method="post">
                <p><input type="text" name="email" placeholder="email"></p>
                <p>
                    <input type="password" name="pwd" placeholder="password"></p>
                </p>
                <p>
                    <input type="submit" value="login">
                </p>
            </form>
        `;
        var list = template.list(request.list);
        var html = template.html(title, list, body, '', '');
        response.send(html);
    })
    
    router.post('/login_process', 
        passport.authenticate('local', { failureRedirect: '/auth/login', failureFlash: true }), (req, res) => {
            req.session.save( () => { res.redirect('/') })
        }
    );

    router.get('/register', function(request, response){
        var title = 'register';
        var body = `
            <form action="/auth/register_process" method="post">
                <p><input type="text" name="email" placeholder="email"></p>
                <p><input type="password" name="pwd" placeholder="password"></p>
                <p><input type="password" name="pwd2" placeholder="password"></p>
                <p><input type="text" name="displayName" placeholder="display name"></p>
                <p><input type="submit" value="register"></p>
            </form>
        `;
        var list = template.list(request.list);
        var html = template.html(title, list, body, '', '');
        response.send(html);
    })

    router.post('/register_process', function(request, response){
        var post = request.body;
        var email = post.email;
        var pwd = post.pwd;
        var pwd2 = post.pwd2;
        var displayName = post.displayName;

        if(pwd !== pwd2){
            console.log('password');
            response.redirect('/auth/register');
        } else {
            dbconn.query(`select * from users where email='${email}'`, (err, results, fields) => {
                if(err) {
                    console.log(err);
                } else {
                    var user = results[0];
                    if(user) {
                        console.log('email already exist');
                        response.redirect('/auth/register');
                    } else {
                        dbconn.query(`select * from users where displayname='${displayName}'`, (err, results, fields) => {
                            var user = results[0]
                            if(user) {
                                console.log('displayName already exist');
                                response.redirect('/auth/register');
                            } else {
                                dbconn.query(`insert into users (email, pwd, displayname) values ('${email}', '${pwd}', '${displayName}')`);
                                
                                var user = {
                                    email: email,
                                    pwd: pwd,
                                    displayname: displayName
                                }
                    
                                request.login(user, function(err){
                                    console.log('redirect');
                                    request.session.save(function(){
                                        response.redirect('/');
                                    })
                                })
                            }
                        })
                    }
                }
            })

           
        }   
    })

    router.get('/kakaoapi', (req, res) => {
        res.redirect(`https://kauth.kakao.com/oauth/authorize?response_type=code&client_id=${kakaoCredentials.web.clientID}&redirect_uri=http://localhost:3002/auth/kakaoapi/callback`);
    })

    router.get('/kakaoapi/callback', async (req, res) => {
        try{//access토큰을 받기 위한 코드
            var token = await axios({//token
                method: 'POST',
                url: 'https://kauth.kakao.com/oauth/token',
                headers:{
                    'Content-Type':'application/x-www-form-urlencoded'
                },
                data: `grant_type=authorization_code&client_id=${kakaoCredentials.web.clientID}&client_secret=${kakaoCredentials.web.clientSecret}&redirectUri=http://localhost:3002/auth/kakaoapi/callback&code=${req.query.code}`
                //여기서 JSON 형식으로 하면 error
                
            })
        } catch(err) {
            console.log(err);
        }

        console.log(token.data);

        var accessToken = token.data.access_token;

        console.log(accessToken);

        try { 
            var result = await axios({
                method: 'GET',
                url: "https://kapi.kakao.com/v1/user/access_token_info",
                headers: {
                "Authorization": `Bearer ${accessToken}`
                }
            })
            console.log('\nresult!!\n', result.data);

        } catch(err) {
            console.log(err);
        }

        res.send('kakaoapi');
    })
    
    router.get('/logout', function(request, response){
        request.logout();
        request.session.save(function(){
            response.redirect('/');
        })
    })
    
    return router;
}