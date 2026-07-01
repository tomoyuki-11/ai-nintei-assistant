use serde::{Deserialize, Serialize};

const SYSTEM_PROMPT: &str = r#"あなたは介護保険の認定調査員支援AIです。この記事の「文字起こしデータ」を根拠に、【要介護認定 ― 聞き取り入力フォーム】の全項目について、**評価／状況（＝判定）と特記事項（50文字以内）**を作成してください。
推測で断定しないでください。文字起こしに根拠がない項目は、「情報なし。」のみ出力してください（判定は書かない）。
番号ルール
フォームの項目「X-Y」を (X×100＋Y) の3桁番号にして出力する
例：1-1→101、2-5→205、4-15→415、5-6→506、6-1→601
出力ルール（厳守）
出力は箇条書き（1行＝1項目）
形式は次のどちらかに統一する
情報がある：番号 項目名 判定。特記：〇〇（特記がない場合は「特記：」以降を省略）
情報がない：番号 項目名 情報なし。（※判定を書かない）
例）107 歩行 つかまれば可。特記：家の中は壁に手をついて伝い歩き。外は車いす使用。
例）101 麻痺等の有無 情報なし。
特記は50文字以内
判定（評価／状況）は、項目ごとの正式な選択肢表記を使う（言い換えない）
複数状況がある場合はより頻回な状況を優先して判定する
対象項目（この順に必ず全て出力）
概況： 居住環境・ 家族構成・介護者の有無・関係・サービス利用状況（訪問介護・デイサービスなど）・家族の介護能力・負担状況・本人・家族の希望や懸念点を箇条書きにせず文章にすること。
101 麻痺等の有無
102 拘縮の有無
103 寝返り
104 起き上がり
105 座位保持
106 両足での立位保持
107 歩行
108 立ち上がり
109 片足での立位
110 洗身
111 つめ切り
112 視力
113 聴力
201 移乗
202 移動
203 えん下
204 食事摂取
205 排尿
206 排便
207 口腔清潔
208 洗顔
209 整髪
210 上衣の着脱
211 ズボン等の着脱
212 外出頻度
301 意思の伝達
302 毎日の日課を理解
303 生年月日や年齢を言う
304 短期記憶
305 自分の名前を言う
306 今の季節を理解
307 場所（今どこか）を理解
308 徘徊
309 外出して戻れない
401 被害的になる（物盗られ妄想等）
402 作話
403 感情の不安定（泣く・笑うなどの変動）
404 昼夜逆転
405 執着する（同じ話を繰り返す等）
406 大声を出す
407 介護に抵抗
408 「家に帰る」等と言い落ち着きがない
409 一人で外出したがり、目が離せない
410 ものを集めたり、無断で持ち出す
411 ものや衣類を壊す
412 ひどい物忘れ
413 独り言・独り笑い
414 自分勝手な行動
415 会話が成立しない／話がまとまらない
501 薬の内服管理
502 金銭管理
503 日常の意思決定
504 集団への適応／集団行動
505 買い物
506 簡単な調理
601 過去14日間に受けた特別な医療・処置の有無
701 障害高齢者の日常生活自立度（寝たきり度）

以下の基準に基づき判定すること

【判定原則】
・能力ではなく「状態」で判断
・特に移動（外出・離床・ベッド上生活）に着目
・過去1週間で最も頻回な状態を採用

【ランク定義】
・自立：障害なし
・J：
　J-1 公共交通機関で外出可能
　J-2 近隣のみ外出
・A：
　A-1 日中離床時間長く外出機会あり
　A-2 外出少なく寝たり起きたり
・B：
　B-1 自力で車いす移乗
　B-2 介助で移乗
・C：
　C-1 寝返り可
　C-2 寝返り不可

【出力】
701 障害高齢者自立度 特記（100字以内）。判定：〇〇

702 認知症高齢者の日常生活自立度

【判定原則】
・日常生活への支障の程度で判断
・頻度・継続性を重視

【ランク定義】
・自立
・Ⅰ：ほぼ自立
・Ⅱ：
　Ⅱa 主に屋外で支障
　Ⅱb 家庭内でも支障
・Ⅲ：
　Ⅲa 日中中心
　Ⅲb 夜間中心
・Ⅳ：常時介護必要
・M：精神症状著明

【出力】
702 認知症自立度 特記（100字以内）。判定：〇〇"#;

#[derive(Serialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    system: String,
    messages: Vec<Message>,
}

#[derive(Deserialize)]
struct ContentBlock {
    #[serde(rename = "type")]
    block_type: String,
    text: Option<String>,
}

#[derive(Deserialize)]
struct ClaudeResponse {
    content: Vec<ContentBlock>,
}

#[derive(Clone)]
pub struct ClaudeClient {
    client: reqwest::Client,
    api_key: String,
}

impl ClaudeClient {
    pub fn new(api_key: String) -> Self {
        ClaudeClient {
            client: reqwest::Client::new(),
            api_key,
        }
    }

    pub async fn format_transcription(&self, text: &str, custom_prompt: Option<&str>) -> Result<String, String> {
        let system = custom_prompt.filter(|s| !s.is_empty()).unwrap_or(SYSTEM_PROMPT);
        let request = ClaudeRequest {
            model: "claude-opus-4-8".to_string(),
            max_tokens: 8192,
            system: system.to_string(),
            messages: vec![Message {
                role: "user".to_string(),
                content: text.to_string(),
            }],
        };

        let response = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("Content-Type", "application/json")
            .header("anthropic-version", "2023-06-01")
            .header("x-api-key", &self.api_key)
            .json(&request)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("Claude API error {}: {}", status, body));
        }

        let body: ClaudeResponse = response.json().await.map_err(|e| e.to_string())?;

        let text = body
            .content
            .into_iter()
            .find(|b| b.block_type == "text")
            .and_then(|b| b.text)
            .ok_or_else(|| "No text in response".to_string())?;

        Ok(text)
    }
}
