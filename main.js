const express = require('express')
const app = express()
const port = 3002 
var fs = require('fs');
var bodyParser = require('body-parser');
var compression = require('compression');
var session = require('express-session');
var FileStore = require('session-file-store')(session)
var flash = require('connect-flash');

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(compression());
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    store: new FileStore()
}));

var passport = require('./lib/passport')(app);

app.use(flash());

// session store에 데이터를 저장했다가 사용하면 지워지는 1회용 message
app.get('/flash', function(req, res) {
    // Set a flash message by passing the key, followed by the value, to req.flash().
    req.flash('msg', 'Flash is back!!')
    res.send('flash');
});

app.get('/flash-display', function(req, res){
    // Get an array of flash messages by passing the key to req.flash()
    var fmsg = req.flash();
    res.send(fmsg);
});

app.get('*', function(request, response, next){
    fs.readdir('./data', function(error, filelist){
        request.list = filelist;
        next();
    });
});

var indexRouter = require('./routes/index');
var topicRouter = require('./routes/topic');
var authRouter = require('./routes/auth')(passport);
var msgRouter = require('./routes/msg');

app.use('/auth', authRouter);
app.use('/', indexRouter);
app.use('/topic', topicRouter);
app.use('/msg', msgRouter);

app.use(function(req, res, next) {
    res.status(404).send('404 Not Found');
})

app.use(function(err, req, res, next) {
    console.error(err.stack)
    res.status(500).send('Error!!');
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})