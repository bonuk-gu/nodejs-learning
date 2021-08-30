var express = require('express');
var router = express.Router();
var template = require('../lib/template.js');
var auth = require('../lib/auth');
var CryptoJS = require('crypto-js');
var axios = require('axios');
var kakaoCredentials = require('../config/kakao.json');
const naverCredentials = require('../config/naver.json')
const { isLoggedIn } = require('../lib/middleware');

router.get('/sms', isLoggedIn, function(request, response){
    // if(!auth.isOwner(request, response)){
    //     response.redirect('/');
    //     return false;
    // }
    var title = 'sms';
    var list = template.list(request.list);
    var html = template.html(title, list, `<form action="/msg/sms_process" method="post">
        <p><input type="text" name="number" placeholder="number"></p>
        <p>
            <textarea name="message" placeholder="message"></textarea>
        </p>
        <p>
            <input type="submit">
        </p>
    </form>`, '', auth.statusUI(request, response));
    response.send(html);
})

router.post('/sms_process', isLoggedIn, async (request, response) => {
    var post = request.body;
    var number = post.number;
    var message = post.message;
    await send_message(number, message); // async, await remind!!
    console.log("complete");
    response.redirect('/msg/sms');
})

send_message = async (number, message) => {
    var user_phone_number = number;
    var contents = message;

    const date = Date.now().toString();
    const uri = naverCredentials.sms.uri; //서비스 ID
    const secretKey = naverCredentials.sms.secretKey; // Secret Key
    const accessKey = naverCredentials.sms.accessKey; //Access Key
    const method = "POST";
    const space = " ";
    const newLine = "\n";
    const url = `https://sens.apigw.ntruss.com/sms/v2/services/${uri}/messages`;
    const url2 = `/sms/v2/services/${uri}/messages`;

    const hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, secretKey);

    hmac.update(method);
    hmac.update(space);
    hmac.update(url2);
    hmac.update(newLine);
    hmac.update(date);
    hmac.update(newLine);
    hmac.update(accessKey);

    const hash = hmac.finalize();
    const signature = hash.toString(CryptoJS.enc.Base64);
        
    const body = {
        type: "SMS",
        countryCode: "82",
        from: "01033235673", // 인증받은 번호만 사용 가능
        content: contents,
        messages: [
            { to: `${user_phone_number}` }
        ],
    }

    const options = {
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "x-ncp-iam-access-key": accessKey,
            "x-ncp-apigw-timestamp": date,
            "x-ncp-apigw-signature-v2": signature,
        },
    }

    await axios.post(url, body, options)
        .then( res => { console.log(res) })
        .catch( err => { console.log(err) })
}

router.get('/kakao', isLoggedIn, (request, response) => {
    var title = 'Kakao';
    var list = '';
    var html = template.html(title, list, 
        '<a href="/msg/kakao/sendmetext">나에게 보내기</a> | <a href="/msg/kakao/sendfriendstext">친구에게 보내기</a> | <a href="/msg/kakao/unlink">연결 끊기</a>' , 
        '', 
        auth.statusUI(request, response));
    
    response.send(html);
});

// 카카오 연결끊기
router.get('/kakao/unlink', isLoggedIn, async (req, res) => {
    axios({
        url: "https://kapi.kakao.com/v1/user/unlink",
        method: 'POST',
        headers: { 
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `KakaoAK ${kakaoCredentials.web.adminKey}`
        },
        params: {
            "target_id_type": "user_id",
            "target_id": `${req.session.passport.user.kakao_id}`
        }
    })
    .then((response) => {
        console.log("success");
        console.log(response);
        res.redirect('/auth/logout');
    })
    .catch((err) => {
        console.log("err");
        console.log(err.response.headers);
        console.log(err.response);
    })
    
})

// 나에게 메시지 보내기
router.get('/kakao/sendmetext', isLoggedIn, async (req, res) => {
    var title = 'KakaoMessage';
    var list = '';
    var html = template.html(title, list, `<form action="/msg/kakao/sendmetext_process" method="post">
        <p>
            <textarea name="message" placeholder="message"></textarea>
        </p>
        <p>
            <input type="submit">
        </p>
    </form>`, '', auth.statusUI(req, res));
    res.send(html);
})

router.post('/kakao/sendmetext_process', isLoggedIn, async (req, res) => {
    try {
        var result2 = await axios({
            method: 'POST',
            url: "https://kapi.kakao.com/v2/api/talk/memo/default/send",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": `Bearer ${req.session.passport.user.accessToken}`
            },
            data: 'template_object='+JSON.stringify({   
                    'object_type': 'text',
                    'text': `${req.body.message}`,
                    'link': {
                        'web_url': 'https://developers.kakao.com',
                        'mobile_web_url': 'https://developers.kakao.com'
                    },
                    'button_title': '바로 확인'
                })
        })
    } catch (err) {
        console.log(err);
    }
    console.log(result2.data);

    res.send('sendmetext');
})

// 친구에게 메시지 보내기
router.get('/kakao/sendfriendstext', isLoggedIn, (req, res) => {
    // 추가 항목(친구 목록) 동의 받기
    res.redirect(`https://kauth.kakao.com/oauth/authorize?client_id=${kakaoCredentials.web.clientID}&redirect_uri=http://localhost:3002/msg/kakao/sendfriendstext/auth&response_type=code&scope=friends`);
})

router.get('/kakao/sendfriendstext/auth', isLoggedIn, async (req, res) => {
    // 토큰 받기, 한번 인증하고 나면 추가로 인증하지 않아도 됨
    try{
        var token = await axios({
            method: 'POST',
            url: 'https://kauth.kakao.com/oauth/token',
            headers:{
                'Content-Type':'application/x-www-form-urlencoded'
            },
            data: `grant_type=authorization_code&client_id=${kakaoCredentials.web.clientID}&client_secret=${kakaoCredentials.web.clientSecret}&redirectUri=http://localhost:3002/msg/kakao/sendfriendstext_process&code=${req.query.code}`
            // 여기서 JSON 형식으로 하면 error
        })
    } catch(err) {
        console.log(err);
    }
    
    console.log('\ntoken data\n', token.data);

    var accessToken = req.session.passport.user.accessToken;
    let friends_info;

    // 친구 목록 받아오기
    try {
        const friends = await axios({
            method: 'GET',
            url: 'https://kapi.kakao.com/v1/api/talk/friends',
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        })
        console.log('\nfriends!!!!\n', friends.data);
        friends_info=friends.data;
    } catch (err) {
        console.log(err);
    }
    
    // 메시지 작성을 위한 form
    var title = 'sendFriendsMessage';
    var list = '';
    var html = template.html(title, list, `<form action="/msg/kakao/sendfriendstext_process" method="post">
        <input type="hidden" name="accessToken" value="${accessToken}" />
        <input type="hidden" name="uuid" value="${friends_info.elements[0].uuid}"
        <p>
            <textarea name="message" placeholder="message"></textarea>
        </p>
        <p>
            <input type="submit">
        </p>
    </form>`, '', auth.statusUI(req, res));
    res.send(html);
})

router.post('/kakao/sendfriendstext_process', isLoggedIn, async (req, res) => {
    try {
        const result = await axios({
            method: 'POST',
            url: 'https://kapi.kakao.com/v1/api/talk/friends/message/default/send',
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": `Bearer ${req.body.accessToken}`
            },
            data: 'template_object='+JSON.stringify({   
                'object_type': 'text',
                'text': `${req.body.message}`,
                'link': {
                    'web_url': 'https://developers.kakao.com',
                    'mobile_web_url': 'https://developers.kakao.com'
                },
                'button_title': '바로 확인'
            })+'&receiver_uuids='+JSON.stringify([`${req.body.uuid}`])
        })
        console.log(result);
    } catch(err) {
        console.error(err);
    }
    res.send('sendfriendstext');
})

module.exports = router;