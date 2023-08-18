const express = require('express')
const app = express()
const env = process.env.NODE_ENV || 'development'
const config = require('./config/config.json')[env]

const { engine } = require('express-handlebars')

app.engine('.hbs', engine({ extname: '.hbs' }))
app.set('view engine', '.hbs')
app.set('views', './views')

app.use(express.static(__dirname + '/public'))

app.get('/', async (req, res) => {
    const env = process.env
    const validators = []

    validators.push(new Validator(
        '環境變數 NODE_ENV',
        env.NODE_ENV,
        `<div>EB 環境變數 <strong style="color: red;">NODE_ENV</strong>，用來設定 <strong>執行環境</strong>，並能讓 sequelize 在 config/config.json 找到對應的連線設置</div>
         <div>在未設置的情況下，sequelize 預設取用 config/config.json 中的 development 連線設置</div>`,
        '在 EB Configuration 中加入 NODE_ENV 環境變數，值設為 production',
        'NODE_ENV',
        env.NODE_ENV && env.NODE_ENV === 'production'
    ))

    validators.push(new Validator(
        'config/config.json use_env_variable',
        config && config.use_env_variable,
        `<div>專案中 config/config.json 的設定，用來讓 sequelize 判定是否改為取用環境變數作為連線字串</div>
         <div>在對應環境的連線設置中，加入 use_env_variable 屬性時，sequelize 會取用該屬性值對應的環境變數</div>`,
        '在 config/config.json 中的 production 連線設置，加入 "use_env_variable": "DATABASE_URL"',
        'use_env_variable',
        config && config.use_env_variable === 'DATABASE_URL'
    ))

    validators.push(new Validator(
        '環境變數 DATABASE_URL',
        env.DATABASE_URL && env.DATABASE_URL.replace(/\/\/.*\//, "//{{連線資訊已遮蔽}}/"),
        `<div>EB 環境變數  <strong style="color: red;">DATABASE_URL</strong>，用來設定 <strong>資料庫連線字串</strong></div>
         <div>當 config/config.json 對應環境的連線設置中加入 use_env_variable 時，依據 use_env_variable 指定的值，找到環境變數，並取用該環境變數值作為連線字串，為了統一做法，變數名稱需設定為 <strong style="color: red;">DATABASE_URL</strong></span>`,
        '在 EB Configuration 中加入 DATABASE_URL 環境變數，值為 RDS 的連線字串，格式為 mysql://{{rds-user-name}}:{{rds-password}}@{{rds-endpoint}}/{{db-name}}，如 mysql://admin:password@database-1.xxxxxxxx.ap-northeast-1.rds.amazonaws.com/test',
        'DATABASE_URL',
        !!env.DATABASE_URL
    ))

    const dataValidator = new Validator(
        'db migration',
        '',
        `<div>驗證 eb create / eb deploy 後是否成功執行 migration</div>
         <div>依據 .ebextensions/migration.config 裡的 container_commands，在 eb 部署後，按照 command 名稱依序執行</div>`,
        '驗證前三項是否皆設定完成，並確認 .ebextensions/migration.config 的指令正確，如果部署失敗，可以透過 eb ssh 連線到 instance，並檢視 /var/log/cfn-init-cmd.log 以除錯',
        false
    )

    try
    {
        const db = require('./models')
        const Foo = db.Foo
        const foos = await Foo.findAll({ attributes: ['name'], raw: true })
        if (foos && foos.length > 0)
        {
            dataValidator.content = '資料正確'
            dataValidator.isSuccess = true
        }
    }
    catch
    {
        dataValidator.isSuccess = false
    }
    finally
    {
        validators.push(dataValidator)
    }


    res.render('index', { validators })
})

const port = 3000
app.listen(port, () => {
    console.log(`App is running on http://localhost:${port}`)
})

class Validator {
    constructor(name, content, desc, suggestion, image, isSuccess) {
        this.name = name
        this.content = content
        this.desc = desc
        this.suggestion = suggestion
        this.image = image
        this.isSuccess = isSuccess
    }
}
