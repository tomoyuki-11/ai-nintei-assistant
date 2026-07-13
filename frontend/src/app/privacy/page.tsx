export const metadata = {
  title: 'プライバシーポリシー | AI認定調査アシスタント',
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">プライバシーポリシー</h1>
        <p className="text-xs text-gray-400 mb-8">制定日：2026年7月13日</p>

        <div className="space-y-8 text-sm text-gray-700 leading-relaxed">

          <section>
            <p>
              本プライバシーポリシー（以下「本ポリシー」）は、AI認定調査アシスタント（以下「本サービス」）において、運営者がユーザーの個人情報をどのように収集・利用・管理するかを説明するものです。本サービスをご利用になる前に、本ポリシーをよくお読みください。
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">1. 運営者について</h2>
            <p>
              本サービスは個人が開発・運営しています（法人・団体ではありません）。
            </p>
            <div className="mt-2 bg-gray-100 rounded-lg px-4 py-3 text-xs">
              <p>運営者：運営者</p>
              <p>サービスURL：【サービスURL】</p>
              <p>お問い合わせ：tomoyukiyasohara@gmail.com</p>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">2. 収集する情報</h2>
            <p className="mb-3">本サービスでは、以下の情報を収集します。</p>

            <h3 className="font-medium text-gray-900 mb-1">（1）アカウント情報</h3>
            <ul className="list-disc list-inside space-y-1 mb-4 pl-2">
              <li>メールアドレス（ログインID・連絡先として使用）</li>
              <li>パスワード（bcrypt等により不可逆なハッシュ化処理を施した上で保管します。元のパスワードは保管しません）</li>
            </ul>

            <h3 className="font-medium text-gray-900 mb-1">（2）利用・決済情報</h3>
            <ul className="list-disc list-inside space-y-1 mb-4 pl-2">
              <li>月ごとのサービス利用回数</li>
              <li>加入プランの種別および状態（トライアル・従量課金・月額）</li>
              <li>Stripe社が発行する顧客ID・サブスクリプションID（クレジットカード番号等の決済情報は、本サービスのサーバーには一切保存しません）</li>
            </ul>

            <h3 className="font-medium text-gray-900 mb-1">（3）調査記録（保存設定による）</h3>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>文字起こしテキスト：録音した音声の文字起こし結果</li>
              <li>整形テキスト：AIが認定調査形式に整形した記録</li>
              <li>作成日時・作成者名</li>
            </ul>
            <p className="mt-2 text-xs text-gray-500">
              ※ 保存設定を「確認後に保存」にした場合、ユーザーが明示的に保存を選択した場合のみデータベースに記録されます。
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">3. 音声データの取り扱い</h2>
            <p className="mb-2">
              録音した音声ファイルは、<strong>本サービスのサーバーには保存されません</strong>。
            </p>
            <p className="mb-2">
              音声データは文字起こし処理のためにOpenAI社のWhisper APIへ送信され、テキスト変換の完了後にサーバー上から消去されます。サーバーが音声データを保持するのは、文字起こし処理が完了するまでの一時的な間のみです。
            </p>
            <p className="text-xs text-gray-500">
              ※ OpenAI社における音声データの取り扱いについては、OpenAI社のプライバシーポリシーをご確認ください。
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">4. 外部サービスへの情報送信</h2>
            <p className="mb-3">
              本サービスは、サービスの提供にあたり以下の外部サービスへデータを送信します。本サービスをご利用いただくことで、以下の各社のプライバシーポリシーにも同意したものとみなします。
            </p>

            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-1">OpenAI（音声文字起こし）</h3>
                <p className="text-xs mb-1"><span className="text-gray-500">送信するデータ：</span>録音した音声データ</p>
                <p className="text-xs mb-1"><span className="text-gray-500">目的：</span>Whisper APIを用いた音声の文字起こし</p>
                <p className="text-xs">
                  <span className="text-gray-500">プライバシーポリシー：</span>
                  <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                    https://openai.com/policies/privacy-policy
                  </a>
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-1">Anthropic（AI整形）</h3>
                <p className="text-xs mb-1"><span className="text-gray-500">送信するデータ：</span>文字起こしテキスト</p>
                <p className="text-xs mb-1"><span className="text-gray-500">目的：</span>Claude APIを用いた認定調査記録への整形・構造化</p>
                <p className="text-xs">
                  <span className="text-gray-500">プライバシーポリシー：</span>
                  <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                    https://www.anthropic.com/privacy
                  </a>
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-1">Stripe（決済処理）</h3>
                <p className="text-xs mb-1"><span className="text-gray-500">送信するデータ：</span>決済に必要な情報（Stripeの画面上で直接入力。クレジットカード情報は本サービスのサーバーを経由しません）</p>
                <p className="text-xs mb-1"><span className="text-gray-500">目的：</span>月額プランおよびクレジット購入の決済処理</p>
                <p className="text-xs">
                  <span className="text-gray-500">プライバシーポリシー：</span>
                  <a href="https://stripe.com/jp/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                    https://stripe.com/jp/privacy
                  </a>
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">5. 要介護認定対象者の情報について</h2>
            <p className="mb-2">
              本サービスで録音・入力される調査内容には、要介護認定の対象となる方（以下「調査対象者」）の氏名・健康状態・日常生活の状況・家族構成などの個人情報が含まれる可能性があります。
            </p>
            <p className="mb-2">
              これらの情報は、文字起こしおよびAI整形の処理を通じて上記の外部サービスへ送信されます。また、保存設定に応じてデータベースに記録されます。
            </p>
            <p className="text-xs text-gray-500">
              ※ 本サービスをご利用の調査員は、調査対象者ご本人またはご家族に対して本サービスの利用（録音・AIによる処理を含む）について説明し、同意を得た上でご使用ください。
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">6. データの保管・セキュリティ</h2>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>データはAWS（Amazon Web Services）上のサーバーで管理しています</li>
              <li>通信はすべてHTTPS（SSL/TLS暗号化）で行われます</li>
              <li>パスワードはハッシュ化して保管し、元のパスワードは保持しません</li>
              <li>ログイン状態は認証トークン（JWT）としてお使いのデバイスのlocalStorageに保存されます</li>
              <li>Google Analyticsなどのアクセス解析ツールは使用していません</li>
              <li>認証Cookieは使用していません</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">7. データの保持期間と削除</h2>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>
                <span className="font-medium">調査記録：</span>
                ユーザーが手動で削除するまで保管されます。履歴画面からいつでも削除できます。
              </li>
              <li>
                <span className="font-medium">Excelダウンロード済みの記録：</span>
                ダウンロードから5日が経過した時点で自動的に削除されます。
              </li>
              <li>
                <span className="font-medium">アカウントの削除：</span>
                アカウントの削除をご希望の場合は、お問い合わせ先までご連絡ください。削除後はデータを復元できません。
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">8. 情報の利用目的</h2>
            <p className="mb-2">収集した情報は以下の目的にのみ利用します。</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>本サービスの提供・維持・改善</li>
              <li>ユーザー認証およびアカウント管理</li>
              <li>利用プランおよびクレジットの管理</li>
              <li>ご利用に関するお問い合わせへの対応</li>
              <li>法令に基づく開示が必要な場合の対応</li>
            </ul>
            <p className="mt-2">
              上記以外の目的での利用や、第三者への個人情報の売買・無断提供は行いません。
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">9. ユーザーの権利</h2>
            <p className="mb-2">ユーザーは以下の権利を有します。</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>保存された調査記録を履歴画面から確認・削除する権利</li>
              <li>アカウントの削除を依頼する権利</li>
              <li>保有する個人情報の開示・訂正を求める権利</li>
            </ul>
            <p className="mt-2">
              上記のご要望は、お問い合わせ先へのメールにてお受けします。ご本人確認のうえ、合理的な期間内に対応します。
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">10. 未成年者の利用</h2>
            <p>
              本サービスは、18歳以上の方を対象としています。18歳未満の方がご利用になる場合は、保護者の同意を得てください。
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">11. 本ポリシーの変更</h2>
            <p>
              本ポリシーの内容は、法令の改正やサービスの変更等に応じて予告なく変更する場合があります。重要な変更を行う場合は、サービス内でお知らせします。変更後も本サービスを継続してご利用いただいた場合は、変更後のポリシーに同意したものとみなします。
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">12. お問い合わせ</h2>
            <p className="mb-2">
              個人情報の取り扱いに関するご質問・ご要望は、以下までご連絡ください。
            </p>
            <div className="bg-gray-100 rounded-lg px-4 py-3 text-xs">
              <p>メールアドレス：tomoyukiyasohara@gmail.com</p>
              <p className="mt-1 text-gray-500">お問い合わせには、通常3営業日以内にご返答します。</p>
            </div>
          </section>

        </div>

        <p className="mt-10 text-xs text-gray-400 text-right">制定日：2026年7月13日</p>
      </div>
    </main>
  )
}
