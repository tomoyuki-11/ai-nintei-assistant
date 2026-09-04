import ExcelJS from "exceljs";

type ExcelRow = [string, string, string, string];

const ITEM_NAMES: Record<string, string> = {
  "101": "麻痺等の有無",
  "102": "拘縮の有無",
  "103": "寝返り",
  "104": "起き上がり",
  "105": "座位保持",
  "106": "両足での立位保持",
  "107": "歩行",
  "108": "立ち上がり",
  "109": "片足での立位",
  "110": "洗身",
  "111": "つめ切り",
  "112": "視力",
  "113": "聴力",
  "201": "移乗",
  "202": "移動",
  "203": "えん下",
  "204": "食事摂取",
  "205": "排尿",
  "206": "排便",
  "207": "口腔清潔",
  "208": "洗顔",
  "209": "整髪",
  "210": "上衣の着脱",
  "211": "ズボン等の着脱",
  "212": "外出頻度",
  "301": "意思の伝達",
  "302": "毎日の日課を理解",
  "303": "生年月日や年齢を言う",
  "304": "短期記憶",
  "305": "自分の名前を言う",
  "306": "今の季節を理解",
  "307": "場所（今どこか）を理解",
  "308": "徘徊",
  "309": "外出して戻れない",
  "401": "被害的になる（物盗られ妄想等）",
  "402": "作話",
  "403": "感情の不安定（泣く・笑うなどの変動）",
  "404": "昼夜逆転",
  "405": "執着する（同じ話を繰り返す等）",
  "406": "大声を出す",
  "407": "介護に抵抗",
  "408": "「家に帰る」等と言い落ち着きがない",
  "409": "一人で外出したがり、目が離せない",
  "410": "ものを集めたり、無断で持ち出す",
  "411": "ものや衣類を壊す",
  "412": "ひどい物忘れ",
  "413": "独り言・独り笑い",
  "414": "自分勝手な行動",
  "415": "会話が成立しない／話がまとまらない",
  "501": "薬の内服管理",
  "502": "金銭管理",
  "503": "日常の意思決定",
  "504": "集団への適応／集団行動",
  "505": "買い物",
  "506": "簡単な調理",
  "601": "過去14日間に受けた特別な医療・処置の有無",
  "701": "障害高齢者の日常生活自立度（寝たきり度）",
  "702": "認知症高齢者の日常生活自立度",
};

function parseContent(content: string): [string, string] {
  content = content.replace(/\*\*/g, "");
  // 「判定：〇〇」形式（701/702など）
  const withJudgment = content.match(/^(.*?)\s*判定[：:](.+)$/);
  if (withJudgment) {
    return [withJudgment[2].trim(), withJudgment[1].replace(/。$/, "").trim()];
  }

  // 「〇〇。特記：〇〇」形式
  const withNote = content.match(/^(.*?)[。]\s*特記[：:](.+)$/);
  if (withNote) {
    return [withNote[1].trim(), withNote[2].trim()];
  }

  // 判定のみ（特記なし）
  return [content.replace(/。$/, "").trim(), ""];
}

function parseResult(text: string): ExcelRow[] {
  const rows: ExcelRow[] = [["番号", "項目名", "判定", "特記事項"]];
  const lines = text.split("\n");

  let overviewLines: string[] = [];
  let inOverview = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // 概況ブロック検出
    if (/概況/.test(line) && !/^\d/.test(line)) {
      inOverview = true;
      const sameLineMatch = line.match(/概況[：:](.+)/);
      if (sameLineMatch) overviewLines.push(sameLineMatch[1].trim());
      continue;
    }

    if (line === "---" || line === "") {
      inOverview = false;
      continue;
    }

    if (inOverview) {
      if (/^-?\s*\d{3}\s+/.test(line)) {
        inOverview = false;
      } else {
        const clean = line.replace(/\*\*/g, "").trim();
        if (clean) overviewLines.push(clean);
        continue;
      }
    }

    // 3桁番号で始まる行
    const numMatch = line.match(/^-?\s*(\d{3})\s+(.+)$/);
    if (!numMatch) continue;

    const number = numMatch[1];
    const afterNumber = numMatch[2].trim();
    const knownName = ITEM_NAMES[number];

    let itemName: string;
    let content: string;

    if (knownName) {
      if (
        afterNumber.startsWith(knownName + "：") ||
        afterNumber.startsWith(knownName + ":")
      ) {
        itemName = knownName;
        content = afterNumber.slice(knownName.length + 1).trim();
      } else if (afterNumber.startsWith(knownName)) {
        itemName = knownName;
        content = afterNumber.slice(knownName.length).trim();
      } else {
        // 項目名の略称が使われた場合：全角スペース以降を判定として抽出
        itemName = knownName;
        const spaceIdx = afterNumber.indexOf('　');
        content = spaceIdx >= 0 ? afterNumber.slice(spaceIdx + 1) : afterNumber;
      }
    } else {
      const colonMatch = afterNumber.match(/^([^：:]+)[：:](.+)$/);
      if (!colonMatch) continue;
      itemName = colonMatch[1].trim();
      content = colonMatch[2].trim();
    }

    if (/^情報なし[。]?$/.test(content)) {
      rows.push([number, itemName, "情報なし", ""]);
    } else {
      const [judgment, note] = parseContent(content);
      rows.push([number, itemName, judgment, note]);
    }
  }

  if (overviewLines.length > 0) {
    rows.splice(1, 0, ["概況", "", "", overviewLines.join(" ")]);
  }

  return rows;
}

export async function downloadExcel(
  formattedText: string,
  filename = "認定調査_結果.xlsx",
) {
  const rows = parseResult(formattedText);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("認定調査");

  worksheet.columns = [
    { width: 8 },
    { width: 40 },
    { width: 30 },
    { width: 100 },
  ];

  rows.forEach((row, i) => {
    // A列の番号を数値型に変換（ヘッダー行と「概況」行は文字列のまま）
    const rowData = i === 0 ? row : [Number(row[0]) || row[0], row[1], row[2], row[3]]
    const excelRow = worksheet.addRow(rowData);
    excelRow.height = 5.25  // 7px相当
    if (i === 0) {
      excelRow.font = { bold: true };
    }
    // 全セルを上揃え、D列は折り返し
    excelRow.eachCell((cell, colNum) => {
      cell.alignment = {
        vertical: "top",
        horizontal: "left",
        wrapText: colNum === 4,
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
