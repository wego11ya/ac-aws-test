# aws-eb-example
__請先確保執行過 `eb init` 及 `eb create`，並依照指示完成建置，在 `eb init`, `eb create` 及 RDS 設置遇到的問題，請先到[AWS 部署共筆](https://www.notion.so/achq/AWS-9efc39157ef54abc9d52b34202cdd7d2)中尋找可能的解答，或是到 discord 中詢問__

> 在這個專案中，控制了 sequelize 資料連線的錯誤，因此在 `eb create` 時不會有錯誤發生，但在其他專案裡，在資料連線設置未完整的情況下，`eb create` 可能會出現建置失敗的訊息

## 部署步驟

1. 設置 `PORT` 環境變數

    在預設的情況下，當外部進入 eb 的 endpoint 網址時，會導至 eb 服務中的 8080 port，但我們的專案監聽的是 3000 port，因此，需要到 EB 的環境變數裡，加入 PORT 3000 的設定
    
    > 當你熟悉雲端服務後，可以嘗試修改 EB Configuration 中的 Instance traffic and scaling 區塊，調整 Processes 的設定，就可以不用加入 PORT 到環境變數中
    
    > 如果專案已經是監聽 8080 port，就不需要更改任何設定

2. 驗證服務啟動成功

    進入 eb endpoint，確認畫面成功出現，這時候的每個驗證項目應該都是失敗的，依據畫面的驗證提示，繼續進行下面步驟的設定

3. 設置 `NODE_ENV` 環境變數
    
    在 EB Configuration 加入 `NODE_ENV` 為 production 的環境變數
    
    儲存變更，待環境變數生效後，重新整理網頁畫面驗證結果，此時 __環境變數 NODE_ENV__ 這一項應該為通過

4. 設定 `config/config.json`

    在專案的 `config/config.json`，找到 production，加入 `use_env_variable` 的屬性，並將值設定為 `DATABASE_URL`，記住這個值
    ```json
    {
        ...,
        "production": {
            "use_env_variable": "DATABASE_URL",
            ...
        }
    }
    ```

    修改後，進行 git commit，再執行 `eb deploy`，待成功部署後，重新整理驗證結果，此時 __config/config.json use_env_variable__ 這一項應該為通過，並且 `設置結果` 顯示的是上面所設置的值 `DATABASE_URL`

    > 使用 use_env_variable 的目的，是為了讓連線字串改為從環境變數取得，避免暴露 production 的連線資訊在 git 版本控制中

5. 設置 `DATABASE_URL` 環境變數
 
    這裡的環境變數名稱依據步驟 4 設定 (即 `DATABASE_URL`)，而值設定為 RDS 的連線字串，格式為 `mysql://{{rds-user-name}}:{{rds-password}}@{{rds-endpoint}}/{{db-name}}`
    
    例如

    ```
    mysql://admin:password@database-1.xxxxxxxx.ap-northeast-1.rds.amazonaws.com/test
    ```

    儲存變更，待環境變數生效後，重新整理網頁畫面驗證結果，此時 __環境變數 DATABASE_URL__ 這一項應該為通過，`設置結果` 顯示的是資料庫連線字串，為了避免資料庫連線資訊暴露，相關資訊已經過遮蔽處理，請確認 `/` 後的 db 名稱為已經建立的 db

    > 請先確保 RDS 的設定正確，且在建立時，Additional configuration - Database options - Initial database name 欄位裡，已經建立可用的 db，並依據 db 名稱修改連線字串 `/` 後的內容

    > 否則需要透過 eb ssh 連線到 eb container，並透過安裝 mariadb，以 client 身份連線到 RDS db 服務，透過 mysql 指令建立 db


6. 加入 deploy 後的 migrate 指令

    新增 .ebextensions/migration.config 檔案，並加入下面的內容

    ```yaml
    container_commands:
        01_schema_migrate:
            command: ./node_modules/.bin/sequelize db:migrate
            leader_only: true
        02_seeder_migrate:
            command: ./node_modules/.bin/sequelize db:seed:all
            leader_only: true
    ```

    目的是為了在 `eb deploy` 時，執行 .ebextensions/migration.config 裡的 command 指令，也就是透過 sequelize 執行 db:migrate 及 db:seed:all，

    修改後，進行 git commit，再執行 `eb deploy`，待成功部署後，重新整理驗證結果，此時 __db migration__ 這一項應該為通過，且 `設置結果` 顯示的是 __資料正確__

    > `01_schema_migrate` 及 `02_seeder_migrate` 是可以自定義的名稱，但要注意執行順序，eb 會依據 command 名稱排序執行，因此加入 01, 02 用以控制執行順序

    > 不使用 npm 搭配 package.json script 的原因在於，在 aws 提供的 node 18 instance 裡執行 eb deploy，會以 root 身份執行 container_commands，在這種情況下，npm 的執行結果，例如 log，會記錄在 /{current_user}/.npm 下，也就是 /root/.npm，基於檔案權限限制，npm 並不被允許讀寫該路徑下的內容，從而導致指令執行失敗，進而引起 eb deploy 失敗
    
    > 在這一步如果發生錯誤，可以利用 `eb ssh` 連線到 container，透過 `cat /var/log/cfn-init-cmd.log` 查看錯誤內容

## 部署完成
透過每個步驟的驗證，能讓你更清楚每一個設定的實際作用，你也可以一次設定完再執行 `eb deploy` 驗證結果