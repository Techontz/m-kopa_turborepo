import type { ReactNode } from "react";

import { backendUrl } from "@/lib/api";
import { money, percent } from "@/lib/format";

import { FREQUENCY_LABEL, type LoanAgreementData } from "./agreement";
import { code128 } from "./barcode";
import styles from "./LoanAgreement.module.css";

const PAGES = 5;

/** Swahili words for the small whole percentages a penalty uses ("asilimia tatu (3%)"). */
const NUMBER_WORDS = ["", "moja", "mbili", "tatu", "nne", "tano", "sita", "saba", "nane", "tisa", "kumi"];

/** The face-scan capture is an API path streamed through the proxy; anything else is already a URL. */
const imageSrc = (url: string | null) => (url ? (/^(https?:)?\//.test(url) ? url : backendUrl(url)) : null);

/** "2026-09-16" → "16/09/2026". */
const dayFirst = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

const isMale = (gender: string | null) => /^(m|male|me|mwanaume)$/i.test((gender ?? "").trim());
const isFemale = (gender: string | null) => /^(f|female|ke|mwanamke)$/i.test((gender ?? "").trim());
const isMarried = (status: string | null) => /married|ndoa|ameoa|ameolewa|kuoa|kuolewa/i.test(status ?? "") && !/single|not|hajaoa|hajaolewa/i.test(status ?? "");

const mark = (label: string, on: boolean) => (on ? `${label} *` : label);

function Barcode({ value }: { value: string }) {
  const widths = code128(value);
  const starts = widths.map((_, index) => widths.slice(0, index).reduce((sum, width) => sum + width, 0));
  const total = widths.reduce((sum, width) => sum + width, 0);
  return (
    <div className={styles.barcode}>
      <svg viewBox={`0 0 ${total} 40`} preserveAspectRatio="none" aria-label={value}>
        {widths.map((width, index) => (index % 2 === 0 ? <rect key={index} x={starts[index]} y={0} width={width} height={40} /> : null))}
      </svg>
      <div>{value}</div>
    </div>
  );
}

function Letterhead({ company, children, code }: { company: LoanAgreementData["company"]; children: ReactNode; code?: string | null }) {
  return (
    <header className={styles.letterhead}>
      <div className={styles.logoBox}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {company.logo_url ? <img src={company.logo_url} alt={company.name} /> : <span className={styles.logoText}>{company.name}</span>}
      </div>
      <div className={code === undefined ? styles.headTitle : styles.headCompany}>{children}</div>
      {code && <Barcode value={code} />}
    </header>
  );
}

function Page({ number, company, title, code, children }: { number: number; company: LoanAgreementData["company"]; title?: string; code?: string | null; children: ReactNode }) {
  return (
    <section className={styles.page}>
      {title !== undefined ? (
        <Letterhead company={company}>{title}</Letterhead>
      ) : (
        <Letterhead company={company} code={code}>
          <div className={styles.companyName}>{company.name.toUpperCase()}</div>
          <div>
            {company.phone && <>Mobil No: {company.phone}</>}
            {company.phone && company.email && ", "}
            {company.email && <>Email:{company.email}</>}
          </div>
        </Letterhead>
      )}
      <div className={styles.body}>{children}</div>
      <footer className={styles.pageNumber}>Page {number} of {PAGES}</footer>
    </section>
  );
}

function Photo({ url }: { url: string | null }) {
  const src = imageSrc(url);
  // eslint-disable-next-line @next/next/no-img-element -- authorised API image stream or stored upload
  return src ? <img src={src} alt="" className={styles.photo} /> : <div className={styles.photoBlank} />;
}

function SignRow({ left, right }: { left: string; right: string }) {
  return (
    <div className={styles.signRow}>
      <span>{left}</span><span className={styles.line} />
      <span>{right}</span><span className={styles.line} />
    </div>
  );
}

/**
 * Mkataba wa Mkopo, laid out as the company's printed agreement: the borrower and loan sheet, the terms (two pages),
 * the repayment list and the payment channels. It is generated after branch manager approval, printed, signed by
 * hand, and the signed copy is uploaded before the credit officer can approve.
 */
export function LoanAgreementDocument({ data }: { data: LoanAgreementData }) {
  const { company, branch, agreement, borrower, loan, schedule, guarantors, collaterals } = data;
  const companyName = company.name.toUpperCase();
  const date = (agreement.approved_at ?? agreement.generated_at).slice(0, 10);
  const address = [borrower.region, borrower.district, borrower.ward, borrower.street].filter(Boolean).join(",");
  const workplace = borrower.business_address ?? borrower.employer ?? borrower.business_name;
  const penalty = loan.penalty?.type === "money"
    ? <>faini ya <b>Tsh. {money(loan.penalty.value)}</b></>
    : (() => {
      const rate = loan.penalty?.value ?? 3;
      const words = Number.isInteger(rate) ? NUMBER_WORDS[rate] : undefined;
      return <>faini ya asilimia {words ? `${words} ` : ""}({percent(rate)}) kwa mwaka</>;
    })();
  const people = guarantors.length > 0 ? guarantors : [null];

  return (
    <div className={styles.document}>
      <Page number={1} company={company} code={borrower.customer_code}>
        <div className={styles.heading}>
          <span>MKATABA WA MKOPO</span>
          <span>{(branch.name ?? "").toUpperCase()}</span>
          <span>{dayFirst(date)}</span>
        </div>

        <div className={styles.withPhoto}>
          <table className={styles.table}>
            <tbody>
              <tr><th colSpan={2} className={styles.caption}>TARIFA ZA MKOPAJI</th><th className={styles.caption}>TAREHE: {date}</th></tr>
              <tr><th>Jina kamili</th><td>{borrower.full_name}</td><th>Jinsia na Hari ya ndoa</th></tr>
              <tr><th>Tarehe ya Kuzaliwa(DD/MM/YY)</th><td>{borrower.date_of_birth}</td><th>{mark("Mwanaume", isMale(borrower.gender))}</th></tr>
              <tr><th>Namba ya kitambulisho</th><td>{borrower.id_number}</td><th>{mark("Mwanamke", isFemale(borrower.gender))}</th></tr>
              <tr><th>Simu ya mkononi</th><td>{borrower.phone}</td><th>{mark("Kuoa / Kuolewa", isMarried(borrower.marital_status))}</th></tr>
              <tr><th>Anwani ya mkopaji</th><td colSpan={2} className={styles.small}>{address}</td></tr>
            </tbody>
          </table>
          <div className={styles.photoCell}><Photo url={borrower.photo_url} /></div>
        </div>

        <table className={`${styles.table} ${styles.loanTable}`}>
          <tbody>
            <tr><th colSpan={2}>TAARIFA ZA MKOPO</th><th>Usajiri wa Mteja</th><th className={styles.strong}>{borrower.customer_code}</th></tr>
            <tr><th>Dhumuni la kukopa</th><td>{loan.purpose}</td><th>Asilimia ya Mkopo</th><td>{percent(loan.interest_rate)}</td></tr>
            <tr><th>Aina ya kazi/biashara</th><td className={styles.small}>{borrower.occupation}</td><th>Mkopo kabla ya riba</th><td>{money(loan.amount)}</td></tr>
            <tr><th>Kipato kwa mwezi (mkopaji)</th><td>{borrower.monthly_income > 0 ? money(borrower.monthly_income) : ""}</td><th>Bima ya mkopo</th><td>{money(loan.insurance)}</td></tr>
            <tr><th>Kituo cha kazi (mkopaji)</th><td>{workplace}</td><th>Aina ya marejesho</th><td className={styles.small}>{FREQUENCY_LABEL[loan.frequency]}</td></tr>
            <tr><th>Gharama ya Fomu</th><td>{money(loan.loan_fee)}</td><th>Idadi ya Marejesho</th><td>{loan.instalments}</td></tr>
            <tr><th>Rejesho</th><td>{money(loan.instalment_amount)}</td><th>Jumla ya mkopo na riba</th><td>{money(loan.total_payable)}</td></tr>
          </tbody>
        </table>

        {people.map((guarantor, index) => (
          <div key={index} className={styles.guarantorBox}>
            <div className={styles.boxTitle}>Idhini ya mdamini</div>
            <p className={styles.consent}>
              Nimekubali kumdhamini kwa hiari yangu mwenyewe bila kushurutishwa na mtu yeyote na nikiwa naakili zangu
              timamu. Endapo mkopaji atashindwa kulipa/ atahama eneo la makazi au kazi, nitawajibika kutoa ushirikiano
              kwa <b>{companyName}</b> kuhakikisha deni/ mkopo wote unalipwa. Na hapa naweka sahihi yangu
              kuidhinisha makubaliano haya <span className={styles.consentLine} />
            </p>
            <div className={styles.withPhoto}>
              <table className={styles.table}>
                <tbody>
                  <tr><th>Taarifa za mdhamini</th><th>Maelezo</th><th>Jinsia na hali ya ndoa</th></tr>
                  <tr><th>Majina matatu</th><td>{guarantor?.full_name}</td><th>{mark("Mwanaume", isMale(guarantor?.gender ?? null))}</th></tr>
                  <tr><th>Simu ya mkononi</th><td>{guarantor?.phone}</td><th>{mark("Mwanamke", isFemale(guarantor?.gender ?? null))}</th></tr>
                  <tr><th>Uhusiano na Mkopaji</th><td>{guarantor?.relationship?.toUpperCase()}</td><th>{mark("Kuoa / Kuolewa", isMarried(guarantor?.marital_status ?? null))}</th></tr>
                </tbody>
              </table>
              <div className={styles.photoCell}><Photo url={guarantor?.photo_url ?? null} /></div>
            </div>
          </div>
        ))}

        <div className={styles.subheading}>DHAMANA ZILIZOWEKWA</div>
        <table className={`${styles.table} ${styles.collaterals}`}>
          <tbody>
            <tr><th>Jina la Dhamana</th><th>Aina ya Dhamana</th><th>Sehemu ilipo</th><th>Thamani ya Dhamana</th></tr>
            {collaterals.map((collateral, index) => (
              <tr key={index}><td>{collateral.name}</td><td>{collateral.type}</td><td>{collateral.location}</td><td>{Math.round(collateral.value)}</td></tr>
            ))}
            {collaterals.length === 0 && <tr className={styles.blankRow}><td /><td /><td /><td /></tr>}
          </tbody>
        </table>

        <SignRow left="Sahihi ya Mkopaji" right="Sahihi ya Afisa Mikopo" />
      </Page>

      <Page number={2} company={company} title="Masharti ya mkopo">
        <div className={styles.terms}>
          <div className={styles.termsTitle}>MKATABA HUU UNASHUHUDIA MAKUBALIANO YAFUATAYO</div>
          <p>
            <b>1.</b> KWAMBA, kulingana na mkataba huu mkopeshaji amekubali kumkopesha mkopaji mnamo<br />
            Tarehe <span className={styles.fill} style={{ width: "72mm" }} /> Tshs<span className={styles.fill} style={{ width: "64mm" }} /> Tsh kwa
            maneno<span className={styles.fill} style={{ width: "124mm" }} />
          </p>
          <p><b>2.</b>Mkopo huu utatozwa riba ya asilimia <b>{percent(loan.interest_rate)}</b> kwa mwaka. Mkopeshaji ana haki ya kubadili riba kutokana na sababu za kiuchumi na viwango vilivyo katika soko.</p>
          <p><b>3.</b>Mkopo huu pia utatozwa ada ya mkopo ya Gharama ya Fomu (Loan fee) <b>Tsh. {money(loan.loan_fee)}</b> ya kiasi cha mkopo ulioidhinishwa. Ada hii hulipwa maramoja na hairudishwi. Mkopo huu utatozwa bima ya mkopo ya <b>Tsh.{money(loan.insurance)}</b> ya kiasi cha mkopo ulioidhinishwa kwa Mwaka;</p>
          <p><b>4.</b> Mkopaji anamruhusu mwajiri wake kukata malipo ya kila mwezi na kuyawasilisha <b>{companyName}</b> kwa dhumuni la kulipa mkopo huu kama ilivyoainishwa kwenye jedwali la marejesho lililoambatanishwa.</p>
          <p><b>5.</b>Kulipa mkopo wote kwa mkupuo mapema inaruhusiwa.</p>
          <p><b>6.</b> Kama masharti yaurejeshaji Mkopo yatavunjwa na Mkopaji, {penalty} ya kiasi cha mkopo ambao haujarejeshwa kitatozwa.</p>
          <p><b>7.</b> Mkopaji atalazimika kufuata na kutekeleza masharti na makubaliano ya mpango wa utekelezaji wa mikopo ya wafanyakazi baina ya <b>{companyName}</b> na kampuni iliyomwajiri.</p>
          <p><b>8 .</b>Mkopeshaji anauwezo wa kukubali au kukataa maombi ya mkopo kwa uamuzi wake binafsi bila kutoa sababu ya kukubali au kukataa ombi.</p>
          <p><b>9.</b> Mkopaji anakubali kwamba Mkopeshaji anauwezo na haki ya kupandisha kiwango cha riba kutoka kiwango cha kawaida kilichotajwa katika kifungu cha 2 cha mkataba huu kwa mwaka endapo Mkopaji atapoteza ajira yake ya sasa kwa sababu yeyote ile</p>
          <p><b>10.</b> Mkopaji anaahidi kutoa dhamana na kusaini nyaraka za kisheria kuhusu dhamana hizo kama ikitokea Mkopaji amapoteza kazi kwa mwajiri.</p>
          <p><b>11.</b> Mkopaji anawajibu kuhakikisha Mkopeshaji anataarifa ya mahali anapoishi baada ya kukoma kwa ajira yake kwa kipindi chote atakapokuwa bado ana deni na Mkopeshaji na anakubali kumjulisha Mkopeshaji ndani ya siku kumi (10) iwapo atabadili anuani kwa kuhama makazi.</p>
          <p><b>12.</b> Makubaliano tofauti na haya hayana nguvu yeyote isipokuwa kama makubaliano hayo yameandikwa na kutiwa saini na pande mbili husika wa makubaliano haya.</p>
          <p><b>13.</b> Kama kwa sababu yeyote iwayo ile sehemu ya makubaliano haya itaonekana kutokuwa ya ukweli na kutotimizwa basi sehemu hiyo itatengwa na kuangaliwa tofauti au kuondolewa inapobidi na haitoathiri sehemu iliyobaki ya makubaliano hayo.</p>
          <SignRow left="Sahihi ya mkopaji" right="Sahihi Afisa mikopo" />
        </div>
      </Page>

      <Page number={3} company={company} title="Masharti ya mkopo">
        <div className={styles.terms}>
          <p><b>14.</b> Mkopaji anakubali kuwa endapo atashindwa kutimiza masharti ya makubaliano haya, Mkopeshaji anahaki ya kuchukua hatua zozote kuweza kufidia deni la mkopaji wa <b>{companyName}</b> katika zoezi hilo ikiwa ni pamoja na huduma za kisheria.</p>
          <p><b>15.</b> Migogoro au kasoro yeyote itakayotokea baina ya mkopaji na mkopeshaji itatatuliwa kwa njia ya mazungumzo na maelewano baina yao. Iwapo kutakuwa na kutokuelewana migogoro hiyo itatatuliwa kwa njia ya usuluhishi kufuata sheria ya Usuluhishi ya Tanzania (Arbitration Act).</p>
          <p>
            <b>16.</b>Itokeapo kukiukwa kwa masharti haya naya nyaraka dhamana zilizoandaliwa, salio la mkopo pamoja na kiwango cha riba kitalazimika kulipwa wakati huo huo kama kukiuka huko kwa masharti hakutarekebishwa ndani ya siku thelathini (30) baada ya <b>{companyName}</b> kumwarifu na kumtaka mkopaji kurekebisha ukiukwaji huo, na yafuatayo yanaweza kuwa vigezo vya kufikiwa kwa uamuzi huu:<br />
            <b>(i).</b>Iwapo mkopaji atashindwa au kukiuka kulipa kwa viwango vya mwezi kama ilivyokubaliwa muda unapofika. Kwa dhumuni la sharti hili, kukiuka kulipa kutatambulika wakati kiwango cha mwezi hakijalipwa ndani ya siku thelathini(30).<br />
            <b>(ii).</b>Iwapo Mwajiri au Mkopaji watakiuka masharti yeyote katika dhamana ya Mwajiri iliyosainiwa na Mwajiri au,<br />
            <b>(iii).</b>Kusimamishwa kwa shughuli za utendaji au biashara kwa mwajiri au kugawanywa kwa mali zote kwa wanaomdai<br />
            <b>(iv).</b>Amri ya mahakama juu ya umiliki wa mali ya mkopaji au kama mkopaji atafanya chochote kusababisha Amri kama hii au<br />
            <b>(v).</b>Mkopaji atavunja au anajaribu kuvunja masharti na makubaliano au;<br />
            <b>(vi).</b>Makubaliano hayo yanapofikia kikomo au;<br />
            <b>(vii).</b>Mkopaji anapofungwa kwa Zaidi ya mwaka mmoja.
          </p>
          <p>
            <b>17.</b>Mkopaji anakubali kuidhinisha Mkopeshaji, taasisi ya fedha au taasisi ya usimamizi mikopo iliyoteuliwa na shirikisho la Mabenki Tanzania.<br />
            <b>(i).</b>Kufanya maulizo kwa benki,taasisi ya usimamizi mikopo iliyoteuliwa na shirikisho la Mabenki Tanzania ili kuthibitisha taarifa zilizotolewa;<br />
            <b>(ii).</b>Kutafuta taarifa zinazonihusu kutoka kwa benki, taasisi ya fedha au taasisi ya usimamizi mikopo iliyoteuliwa na shirikisho la Mabenki Tanzania wakati wowote nifanyiwapo uchunguzi;<br />
            <b>(iii).</b>Kutoa taarifa zangu kuhusiana na mkopo nilionao kwa <b>{companyName}</b> kwa taasisi ya usimamizi mikopo iliyoteuliwa na Shirikisho la Mabenki Tanzania. Mkopaji anatambua na anakubali kwamba ametia saini fomu hii ya maombi kama ishara ya kwamba amekubaliana na masharti yake.
          </p>
          <p><b>18.</b>Mkataba huu na vielelezo vingine ambavyo vinahusiana na mkataba huu mathalani fomu ya kuombea mpkopo, barua za wadhamini, na makubaliano ya mpango wa utekelezaji wa mikopo ya wafanyakazi vitakuwa na kutafsiriwa kama sehemu ya mkataba huu.</p>
          <p><b>19.</b>Mkataba huu wa Mkopo, haki na Majukumu ya pande zote mbili yataendeshwa na kutawaliwa kwa mujibu wa Sheria za Tanzania.</p>
          <SignRow left="Sahihi ya mkopaji" right="Sahihi ya meneja tawi" />
        </div>
      </Page>

      <Page number={4} company={company} title="ORODHA YA MAREJESHO">
        <table className={`${styles.table} ${styles.schedule}`}>
          <tbody>
            <tr><th>S/No.</th><th>Tarehe</th><th>Rejesho</th></tr>
            {schedule.map((row) => (
              <tr key={row.number}><td>{row.number}.</td><td>{row.due_date}</td><td>{money(row.amount)}</td></tr>
            ))}
            <tr><th>TOTAL</th><th /><th>{money(schedule.reduce((sum, row) => sum + row.amount, 0))}</th></tr>
          </tbody>
        </table>
      </Page>

      <Page number={5} company={company} title={`NJIA ZA MALIPO ${companyName}`}>
        <div className={styles.terms}>
          <p>
            TAHADHARI MUHIMU<br />
            Kampuni haipokei malipo ya fedha taslimu (cash). Hatutahusika na upotevu wa fedha yoyote itakayolipwa nje ya njia rasmi zilizoainishwa hapa chini. Tafadhali fuata maelekezo haya kikamilifu.
          </p>
          <p><b>(i).MALIPO KWA SIMU</b></p>
          <p>
            <b>(1) KWA WATUMIAJI WA VODACOM (M-PESA)</b><br />
            1. Piga *150*00<b>#</b><br />
            2. Chagua 4 – Lipa kwa M-Pesa<br />
            3. Chagua 4 – Lipa kwa kampuni<br />
            4. Weka namba ya kampuni: <b>944320</b><br />
            5. Weka kiasi unachotakiwa kulipa<br />
            6. Weka namba ya kumbukumbu; <b>WEKA JINA LAKO KAMILI AU JINA LA KIKUNDI CHAKO</b><br />
            7. Weka namba ya siri (PIN) kuthibitisha malipo<br />
            Utapokea ujumbe wa uthibitisho mara baada ya malipo kufanyika jina la <b>{companyName}</b>.
          </p>
          <p>
            <b>(2).KWA WATUMIAJI WA AIRTEL MONEY</b><br />
            1. Piga *150*60<b>#</b><br />
            2. Chagua 5 – Lipa bili / Make payments<br />
            3. Chagua 4 – Lipa kwa kampuni (Business Number)<br />
            4. Weka namba ya kampuni: <b>567043</b><br />
            5. Weka kiasi unachotakiwa kulipa<br />
            6. Weka namba ya kumbukumbu ya malipo: <b>ANDIKA JINA LAKO KAMILI AU JINA LA KIKUNDI CHAKO</b><br />
            7. Weka namba ya siri (PIN) kuthibitisha malipo<br />
            Utapokea ujumbe wa uthibitisho mara baada ya malipo kufanyika jina la <b>{companyName}</b>.
          </p>
          <p><b>(ii).MALIPO KWA NJIA YA BENKI</b></p>
          <p>
            <b>(1)NMB BANK.</b><br />
            Account Number: <b>33410053458</b><br />
            Jina la Account Number <b>{companyName}</b><br />
            Maelezo ya muamala Au jina la mwekaji;<br />
            -&gt;ANDIKA JINA LAKO KAMILI
          </p>
          <p>
            <b>(2).CRDB BANK.</b><br />
            Account Number: <b>015000100LA00</b><br />
            Jina la Account <b>{companyName}</b><br />
            Maelezo ya muamala Au jina la mwekaji;<br />
            -&gt; ANDIKA JINA LAKO KAMILI
          </p>
        </div>
      </Page>
    </div>
  );
}
