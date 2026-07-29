import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { DocumentPage } from "@/components/document-page";

export const metadata: Metadata = {
  title: "The global capital lifecycle",
  description: "A comprehensive research framework for angels, venture capital, philanthropy, private equity, credit, search funds, strategic buyers, and recycled liquidity.",
};

export default function PrivateEquityResearchPage() {
  return (
    <DocumentPage
      eyebrow="RESEARCH / 29 JULY 2026"
      title="From first risk to recycled liquidity."
      intro="Private equity is a valid extension to FirstContact alongside angels, venture capital, philanthropy, development finance, credit, search funds, and strategic buyers. The complete solution is a global capital lifecycle—not one undifferentiated investor list."
    >
      <aside className="research-boundary">
        <strong>PROPOSED DIRECTION / NOT A LIVE CAPABILITY</strong>
        <p>This is research, not investment advice. FirstContact does not currently provide live PE acquisition matching, transaction execution, or due diligence.</p>
      </aside>

      <p>
        <a className="button button-dark" href="/firstcontact-private-equity-research.pdf" download>
          <Download size={16} /> Download the PDF
        </a>
      </p>

      <h2>One system, different jobs</h2>
      <p>
        Capital providers are not interchangeable. Matching a pre-revenue founder to a buyout fund is as misleading as matching a
        profitable succession-stage company only to seed investors. FirstContact should classify the company’s condition, intended
        transaction, governance readiness, and desired outcome before identifying capital.
      </p>
      <div className="research-table-wrap">
        <table className="research-table research-table-wide">
          <thead><tr><th>Capital</th><th>Best fit</th><th>Contribution</th><th>Liquidity role</th><th>Main mismatch</th></tr></thead>
          <tbody>
            <tr><td>Philanthropy + grants</td><td>Public goods, research, excluded or pre-commercial innovators</td><td>Validation, capacity, inclusion, shared infrastructure</td><td>Makes later investment possible</td><td>Subsidising an already-commercial deal</td></tr>
            <tr><td>Angels</td><td>Formation, pre-seed, first product and customers</td><td>Judgment, mentoring, introductions, early credibility</td><td>Creates the first investable ownership layer</td><td>Informal terms and weak follow-on capacity</td></tr>
            <tr><td>Venture capital</td><td>Innovative companies capable of rapid, outsized growth</td><td>Hiring, governance, networks and follow-on capital</td><td>Builds assets for strategic or financial exits</td><td>Applying venture expectations to ordinary businesses</td></tr>
            <tr><td>Growth equity</td><td>Proven revenue and a repeatable model ready to scale</td><td>GTM expansion, executive hiring, systems, market entry</td><td>Bridges VC and mature private capital</td><td>Scaling before economics or governance are ready</td></tr>
            <tr><td>Private credit</td><td>Predictable cash flow or financeable assets</td><td>Growth capital without mandatory ownership transfer</td><td>Preserves equity and finances growth or acquisition</td><td>Debt service, leverage and currency mismatch</td></tr>
            <tr><td>SME + impact PE</td><td>Scale, governance, succession or operational transformation</td><td>Systems, digitisation, M&amp;A, market access and exit preparation</td><td>Buys shares and prepares stronger assets</td><td>Excessive control, leverage or mission drift</td></tr>
            <tr><td>Search funds</td><td>One durable, usually profitable succession-stage company</td><td>A dedicated operator to run the acquired company</td><td>Creates an owner exit and new operator-owner</td><td>Seller dependence or unsuitable acquisition debt</td></tr>
            <tr><td>Strategic buyers</td><td>Product, customer, talent, supply-chain or market synergy</td><td>Distribution, procurement, technology and expansion</td><td>Direct partial or complete exit</td><td>Integration failure or loss of independence</td></tr>
            <tr><td>Secondaries</td><td>Shareholders or funds needing liquidity before a company exit</td><td>Time and ownership realignment</td><td>Unlocks trapped private-market capital</td><td>Mispricing, information asymmetry and conflicts</td></tr>
            <tr><td>DFIs + public finance</td><td>Risk, tenor, currency or pioneering gaps</td><td>Standards, guarantees, technical assistance, market creation</td><td>Crowds in capital and builds repeatable markets</td><td>Crowding out and weak additionality</td></tr>
          </tbody>
        </table>
      </div>
      <blockquote className="capital-chain">Use the least dilutive, least concessional, and least risky instrument that genuinely fits the company’s present condition and intended outcome.</blockquote>

      <h2>Angels: first conviction and local knowledge</h2>
      <p>
        Angels can invest before an institution has enough evidence, help test the first product, introduce customers and later
        investors, recruit early leaders, and translate local context that a global fund may miss. They are particularly useful for
        small pre-seed rounds, founders outside established networks, and syndicates combining local diligence with diaspora or
        international capital.
      </p>
      <p>FirstContact should distinguish individual angels, syndicates, family offices, and scouts, then verify:</p>
      <ul>
        <li>check range, lead-versus-follow preference, and follow-on capacity;</li>
        <li>sector, country, eligibility, accreditation, and conflict constraints;</li>
        <li>time available for mentoring, operating support, and governance; and</li>
        <li>current source evidence—never an assumed ability or intention to invest.</li>
      </ul>

      <h2>Venture capital: exceptional uncertainty and growth</h2>
      <p>
        VC is appropriate for young companies whose technology or model can support rapid, very large growth and whose uncertainty
        prevents ordinary bank financing. NVCA describes it as high-risk, long-term equity for innovative young companies, with
        investors contributing strategic guidance, boards, hiring, and networks.{" "}
        <a href="https://nvca.org/about-us/what-is-vc/" target="_blank" rel="noreferrer">NVCA — What is Venture Capital? ↗</a>
      </p>
      <p>
        IFC’s emerging-market VC work combines equity, quasi-equity, venture or asset-backed lending, networks, sector expertise, and
        local regulatory knowledge, while its seed-fund and accelerator investments help companies become ready for later capital.{" "}
        <a href="https://www.ifc.org/en/what-we-do/sector-expertise/venture-capital" target="_blank" rel="noreferrer">IFC — Venture Capital ↗</a>
      </p>
      <p>A credible VC match requires:</p>
      <ul>
        <li>stage, sector, geography, ticket, ownership, reserve, and follow-on fit;</li>
        <li>evidence that the specific fund vehicle is active and can still invest;</li>
        <li>a venture-scale market and plausible return profile;</li>
        <li>founder understanding of dilution, governance, preference rights, and time horizon; and</li>
        <li>milestone-linked use of funds with public thesis evidence kept separate from inferred partner interest.</li>
      </ul>
      <p>VC should not be prescribed to every good business. Revenue, customer finance, credit, patient equity, or acquisition may be a much better fit for a durable local company.</p>

      <h2>Philanthropy and DFIs: prepare, include, and catalyse</h2>
      <p>
        Philanthropy is strongest where commercial investors cannot rationally pay for the full benefit: public goods, basic research,
        ecosystem infrastructure, excluded founders, transaction preparation, open data, policy work, and early proof that benefits a
        wider market.
      </p>
      <ul>
        <li>grants and recoverable grants;</li><li>technical-assistance facilities;</li><li>guarantee or first-loss structures;</li>
        <li>design, feasibility, legal, accounting, governance, and investment-readiness funding;</li>
        <li>local fund-manager development, outcome measurement, local-currency and political-risk support.</li>
      </ul>
      <p>
        OECD principles require a development rationale, additionality, local-context design, commercial mobilisation, transparency,
        and a path toward sustainability. Concessional capital should not crowd out an available private investor or guarantee a
        sponsor’s return merely because a transaction has an impact narrative.{" "}
        <a href="https://www.oecd.org/en/topics/sub-issues/mobilising-private-finance-for-development/blended-finance.html" target="_blank" rel="noreferrer">OECD — Blended finance ↗</a>
      </p>

      <h2>What the research shows</h2>
      <p>Private equity already performs much of what this model proposes:</p>
      <ul>
        <li>Growth-equity investors finance established companies seeking expansion, operational improvement, or entry into new markets.</li>
        <li>Buyout funds acquire controlling or majority ownership.</li>
        <li>Turnaround investors acquire distressed but recoverable businesses.</li>
        <li>Replacement-capital and secondary transactions allow founders and existing investors to sell shares.</li>
        <li>Search funds and entrepreneurship-through-acquisition vehicles acquire smaller profitable companies and install an active operator.</li>
      </ul>
      <p>
        These are recognized PE strategies, rather than a new theoretical model.{" "}
        <a href="https://www.investeurope.eu/publications/private-equity-at-work-2026-report/about-private-equity-24530.html" target="_blank" rel="noreferrer">Invest Europe’s definitions ↗</a>{" "}
        distinguish growth, buyout, turnaround, and replacement capital.
      </p>
      <p>
        There is also direct evidence that the model can address the “missing middle” in emerging markets. IFC’s SME Ventures programme invests through PE funds targeting smaller businesses in underserved countries and supplements capital with networks, training, and market expertise.{" "}
        <a href="https://www.ifc.org/en/what-we-do/sector-expertise/funds/sme-venture-funds" target="_blank" rel="noreferrer">IFC SME Ventures ↗</a>
      </p>
      <p>A particularly close example is IFC’s 2026 investment in Aruwa Capital Fund II. Its stated value-creation activities include:</p>
      <ul>
        <li>market expansion;</li><li>operational efficiency and digitisation;</li><li>capital strategy;</li>
        <li>talent and governance;</li><li>branding and communication;</li><li>M&amp;A integration; and</li><li>exit preparation.</li>
      </ul>
      <p>
        That is very close to the thesis of acquiring or recapitalising companies, solving go-to-market problems, professionalising them, and eventually recycling the capital.{" "}
        <a href="https://disclosures.ifc.org/project-detail/SII/51411/smev-acf-ii" target="_blank" rel="noreferrer">IFC project disclosure ↗</a>
      </p>

      <h2>Does it increase ecosystem liquidity?</h2>
      <p>Potentially, yes—through several mechanisms:</p>
      <ol>
        <li><strong>Founder liquidity.</strong> A founder can sell a minority position, controlling stake, or the entire company.</li>
        <li><strong>Angel and VC liquidity.</strong> PE funds can buy shares from early investors, returning capital that can be reinvested into new startups.</li>
        <li><strong>Company recapitalisation.</strong> A transaction can combine secondary share purchases with new primary capital for expansion.</li>
        <li><strong>Operational value creation.</strong> A capable investor can strengthen management, reporting, governance, sales, pricing, distribution, technology, and market access.</li>
        <li><strong>Exit readiness.</strong> A professionalised company becomes more credible to strategic acquirers, larger PE funds, public markets, or management buyers.</li>
      </ol>
      <p>
        AVCA reported that PE and other financial sponsors represented 18% of African venture-backed exits in 2025, with half of those sponsor exits involving secondary transactions. Trade buyers still represented 70% of exit volume—so corporate acquirers are at least as important as PE for liquidity.{" "}
        <a href="https://www.avca.africa/data-intelligence/research-publications/2025-venture-capital-in-africa-report/" target="_blank" rel="noreferrer">AVCA 2025 Venture Capital in Africa Report ↗</a>
      </p>
      <blockquote className="capital-chain">Angels → VC → growth equity → PE/search funds → strategic buyers/secondaries → recycled capital</blockquote>

      <h2>Search funds deserve special attention</h2>
      <p>
        Traditional PE funds often need transactions that are too large for many overlooked SMEs. Search funds and independent sponsors can cover part of that gap. IESE’s international study found 320 search funds across 40 countries and five continents. The median international acquisition was approximately $11.7 million, so even search funds will not cover the smallest companies—but they demonstrate that operator-led acquisition is already global.{" "}
        <a href="https://www.iese.edu/insight/articles/search-funds-global-growth/" target="_blank" rel="noreferrer">IESE international research ↗</a>
      </p>
      <p>For smaller transactions, FirstContact could eventually include:</p>
      <ul>
        <li>micro-PE funds;</li><li>local SME funds;</li><li>independent sponsors;</li><li>search funds;</li>
        <li>family offices;</li><li>permanent-capital holding companies;</li><li>management buyout investors;</li>
        <li>diaspora investment vehicles; and</li><li>strategic corporate acquirers.</li>
      </ul>

      <h2>Where philanthropy fits</h2>
      <p>Philanthropy can be useful, but it should not normally subsidise the purchase price of an otherwise commercial buyout.</p>
      <p>The strongest philanthropic roles are:</p>
      <ul>
        <li>grants for accounting, legal, governance, and investment-readiness work;</li>
        <li>technical assistance for sales systems, digitisation, impact measurement, and management development;</li>
        <li>first-loss capital or guarantees in genuinely underserved markets;</li>
        <li>funding shared market infrastructure, local fund-manager development, and transaction preparation;</li>
        <li>supporting businesses with strong social value whose risk-return profile is not yet commercially investable.</li>
      </ul>
      <p>
        The OECD says blended finance should mobilise capital that would not otherwise arrive, demonstrate additionality, avoid crowding out commercial investors, use minimum necessary concessionality, and have a path toward commercial sustainability.{" "}
        <a href="https://www.oecd.org/en/publications/oecd-dac-blended-finance-guidance-2025_e4a13d2c-en/full-report/principle-2-design-blended-finance-to-increase-the-mobilisation-of-commercial-finance_996e5e2d.html" target="_blank" rel="noreferrer">OECD blended-finance guidance ↗</a>
      </p>
      <ul>
        <li>Philanthropy absorbs justified early or systemic risk.</li>
        <li>Commercial investors fund commercially viable acquisitions and growth.</li>
        <li>Philanthropy should not guarantee private investors a return merely because a deal has an impact narrative.</li>
      </ul>

      <h2>Important qualification about “10×”</h2>
      <p>“10× the value” is a strong vision, but it should never become a platform claim or matching assumption.</p>
      <p>Some transformations can produce exceptional returns, but most PE transactions are underwritten around more restrained combinations of:</p>
      <ul>
        <li>revenue and margin growth;</li><li>operational improvement;</li><li>debt repayment;</li>
        <li>acquisitions;</li><li>stronger governance; and</li><li>a higher-quality exit.</li>
      </ul>
      <p>FirstContact should describe the objective as “measurable long-term value creation” or “enterprise-value growth,” while allowing individual investors to specify their target return. Promising 10× would encourage inflated projections and potentially attract the wrong operators.</p>
      <p>There are also genuine risks:</p>
      <ul>
        <li>excessive acquisition debt;</li><li>cost cutting that damages employees or customers;</li><li>founder loss of control;</li>
        <li>mission drift;</li><li>forced exits caused by fixed fund lives;</li><li>aggressive consolidation;</li>
        <li>currency and political risk;</li><li>weak local exit markets; and</li><li>investors claiming operational expertise they do not possess.</li>
      </ul>
      <p>These need explicit diligence and governance fields.</p>

      <h2>How I would incorporate it into FirstContact</h2>
      <p>
        The current shared investor contract models a relatively simple VC-style investor: firm, thesis, stages, sectors, geography, and evidence in <code>lib/domain.ts</code>. Matching currently scores stage, sector, geography, and capital-region overlap in <code>lib/matching.ts</code>. That is insufficient for acquisition transactions.
      </p>
      <div className="research-table-wrap">
        <table className="research-table">
          <thead><tr><th>Path</th><th>Appropriate capital</th></tr></thead>
          <tbody>
            <tr><td>Build</td><td>Angels, pre-seed and seed VC, grants</td></tr>
            <tr><td>Scale</td><td>VC, growth equity, private credit</td></tr>
            <tr><td>Transform</td><td>SME PE, impact PE, search funds, independent sponsors</td></tr>
            <tr><td>Exit or succeed</td><td>Strategic buyers, PE buyers, management buyouts, secondaries</td></tr>
          </tbody>
        </table>
      </div>
      <p>PE and acquisition matching would need additional hard requirements:</p>
      <ul>
        <li>transaction type: primary capital, partial secondary, recapitalisation, majority sale, or full acquisition;</li>
        <li>acceptable ownership percentage and control rights;</li>
        <li>revenue, EBITDA, profitability, and enterprise-value range;</li>
        <li>preferred deal and equity-check sizes;</li><li>leverage policy;</li><li>operating history;</li>
        <li>founder’s willingness to remain, transition, or exit;</li><li>succession requirements;</li>
        <li>governance and reporting readiness;</li><li>value-creation capabilities;</li>
        <li>target holding period and exit routes;</li><li>country, currency, regulatory, and jurisdiction restrictions;</li>
        <li>employment, impact, and responsible-ownership commitments; and</li><li>source-backed evidence for every stated mandate.</li>
      </ul>
      <p>Matching should operate at the individual fund or investment-vehicle level, not merely the firm level. A global PE brand may run separate funds with completely different geographies, sizes, sectors, and ownership requirements.</p>

      <h2>Worldwide, without false globalism</h2>
      <p>
        “Worldwide” means representing verified local and cross-border mandates—not claiming every investor invests everywhere. Each
        vehicle needs country, domicile, licensing, sanctions, foreign-ownership, currency, FX, local-presence, language, decision-team,
        cheque, enterprise-value, revenue, EBITDA, vintage, active-period, reserve, and source-date evidence.
      </p>
      <p>
        The strongest network combines local angels and operators, regional funds and lenders, diaspora capital, international
        institutions, strategic buyers, and development partners. Local capital improves context and accountability; cross-border
        capital adds scale, networks, currency, and exit options.
      </p>

      <h2>A responsible matching sequence</h2>
      <ol>
        <li><strong>Classify the need:</strong> grant, first equity, venture round, growth, working capital, recapitalisation, succession, partial liquidity, or sale.</li>
        <li><strong>Apply hard gates:</strong> geography, stage, transaction, ticket, ownership, sector, jurisdiction, source, and current mandate.</li>
        <li><strong>Assess readiness:</strong> evidence, accounts, cap table, governance, data room, management dependence, impact claims, and founder consent.</li>
        <li><strong>Rank value-add:</strong> operating capability, customers, talent, follow-on capital, local knowledge, and credible exits.</li>
        <li><strong>Review harms:</strong> leverage, control, employment, mission, community, concentration, sanctions, corruption, and privacy.</li>
        <li><strong>Require human approval:</strong> no result becomes an introduction, representation, disclosure, or transaction automatically.</li>
        <li><strong>Preserve the audit trail:</strong> source, date, reviewer, approval, changes, suppressions, and outcomes remain in Convex.</li>
      </ol>

      <h2>Measure liquidity, not activity</h2>
      <p>Success should be measured through:</p>
      <ul>
        <li>verified, current, deployable mandates and qualified matches accepted by both sides;</li>
        <li>time to an appropriate capital conversation;</li>
        <li>primary capital mobilised versus secondary liquidity created;</li>
        <li>founder dilution, retained control, follow-on capital, and survival;</li>
        <li>operating improvements, revenue quality, jobs, governance, and responsible exits;</li>
        <li>capital recycled, philanthropic additionality, and commercial capital crowded in; and</li>
        <li>complaints, suppressions, failed matches, mission drift, job losses, and other harms.</li>
      </ul>

      <h2>Verdict</h2>
      <p>This is a valid extra solution and, conceptually, it completes the capital lifecycle:</p>
      <ul>
        <li>Angels finance inception.</li><li>VCs finance high-risk growth.</li><li>Growth equity bridges mature startups.</li>
        <li>PE, search funds, and strategic buyers create ownership transitions and liquidity.</li>
        <li>Philanthropy and DFIs address justified market failures and readiness gaps.</li>
        <li>Successful exits recycle capital back into the ecosystem.</li>
      </ul>
      <p className="document-intro">
        My strongest recommendation is to position the expanded FirstContact as a global capital-and-ownership matching system—not only an investor outreach system. Private equity should be one pillar, but strategic acquirers, search funds, secondaries, and succession capital are necessary if liquidity is the real objective.
      </p>
      <p><Link href="/for-investors">Return to the investor view</Link></p>
    </DocumentPage>
  );
}
