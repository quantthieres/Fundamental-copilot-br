// Small fixtures for macro unit tests, shaped exactly like the official
// responses (IMF SDMX-ML 2.1 StructureSpecificData, BIS SDMX-CSV 2.0) but with
// SYNTHETIC values. They are not real macroeconomic observations.

export const WEO_XML_FIXTURE = `<?xml version='1.0' encoding='UTF-8'?><message:StructureSpecificData xmlns:ss="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/data/structurespecific" xmlns:ns1="urn:sdmx:org.sdmx.infomodel.datastructure.Dataflow=IMF.RES:WEO(9.0.0):ObsLevelDim:TIME_PERIOD" xmlns:message="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message" xmlns:common="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/common" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><message:Header><message:ID>DS1</message:ID><message:Test>false</message:Test><message:Prepared>2026-11-03T00:00:00Z</message:Prepared><message:Sender id="IMF"/><message:Structure structureID="IMF.RES_WEO_9_0_0" namespace="urn:x" dimensionAtObservation="TIME_PERIOD"><common:StructureUsage><Ref agencyID="IMF.RES" id="WEO" version="9.0.0"/></common:StructureUsage></message:Structure><message:DataSetAction>Replace</message:DataSetAction></message:Header><message:DataSet ss:dataScope="DataStructure" xsi:type="ns1:DataSetType" ss:structureRef="IMF.RES_WEO_9_0_0" action="Replace" PUBLISHER="IMF" UPDATE_DATE="2026-10-13T02:00:00Z" PUBLICATION_DATE="2026-10-13T02:00:00Z" LICENSE="&#169; International Monetary Fund Copyright. All Rights Reserved.">
<Group xsi:type="ns1:GROUP_INDICATOR" INDICATOR="PCPIPCH" UNIT="PT" SERIES_NAME="All Items, Consumer price index (CPI), Period average, percent change"/>
<Group xsi:type="ns1:GROUP_COUNTRY__INDICATOR" INDICATOR="PCPIPCH" COUNTRY="BRA" METHODOLOGY_NOTES="Notes with &quot;quotes&quot; &amp; ampersand" LATEST_ACTUAL_ANNUAL_DATA="2025"/>
<Group xsi:type="ns1:GROUP_COUNTRY__INDICATOR" INDICATOR="PCPIPCH" COUNTRY="IND" LATEST_ACTUAL_ANNUAL_DATA="FY2024/25"/>
<Group xsi:type="ns1:GROUP_COUNTRY__INDICATOR" INDICATOR="PCPIPCH" COUNTRY="KOS" LATEST_ACTUAL_ANNUAL_DATA="2023"/>
<Series COUNTRY="BRA" INDICATOR="PCPIPCH" FREQUENCY="A" OVERLAP="OL" DECIMALS_DISPLAYED="3" SCALE="0"><Obs TIME_PERIOD="1999" OBS_VALUE="9.9"/><Obs TIME_PERIOD="2024" OBS_VALUE="1.25"/><Obs TIME_PERIOD="2025" OBS_VALUE="2.5"/><Obs TIME_PERIOD="2026" OBS_VALUE="3.75"/><Obs TIME_PERIOD="2027" OBS_VALUE="4"/></Series>
<Series COUNTRY="IND" INDICATOR="PCPIPCH" FREQUENCY="A" SCALE="0"><Obs TIME_PERIOD="2024" OBS_VALUE="5.5"/><Obs TIME_PERIOD="2025" OBS_VALUE="6.5"/><Obs TIME_PERIOD="2026"/></Series>
<Series COUNTRY="KOS" INDICATOR="PCPIPCH" FREQUENCY="A" SCALE="0"><Obs TIME_PERIOD="2024" OBS_VALUE="1.5"/></Series>
<Series COUNTRY="TWN" INDICATOR="PCPIPCH" FREQUENCY="A" SCALE="0"><Obs TIME_PERIOD="2025" OBS_VALUE="0.5"/></Series>
<Series COUNTRY="G001" INDICATOR="PCPIPCH" FREQUENCY="A" SCALE="0"><Obs TIME_PERIOD="2025" OBS_VALUE="3.3"/></Series>
<Series COUNTRY="GX123" INDICATOR="PCPIPCH" FREQUENCY="A" SCALE="0"><Obs TIME_PERIOD="2025" OBS_VALUE="3.3"/></Series>
<Series COUNTRY="BRA" INDICATOR="LUR" FREQUENCY="A" SCALE="0"><Obs TIME_PERIOD="2025" OBS_VALUE="7.25"/></Series>
</message:DataSet></message:StructureSpecificData>`;

const BIS_HEADER =
  "STRUCTURE,STRUCTURE_ID,ACTION,FREQ,REF_AREA,TIME_PERIOD,OBS_VALUE,UNIT_MEASURE,UNIT_MULT,TIME_FORMAT,COMPILATION,DECIMALS,SOURCE_REF,SUPP_INFO_BREAKS,TITLE,OBS_STATUS,OBS_CONF,OBS_PRE_BREAK";

function bisRow(area: string, period: string, value: string, status = "A", unit = "368"): string {
  return `dataflow,BIS:WS_CBPOL(1.0),I,M,${area},${period},${value},${unit},0,,"Policy rate, synthetic ""note""",4,Central bank,, Central bank policy rates - ${area} - Monthly - End of period,${status},F,`;
}

export const BIS_CSV_FIXTURE = [
  BIS_HEADER,
  bisRow("BR", "2024-11", "10.5"),
  bisRow("BR", "2024-12", "11"),
  bisRow("BR", "2025-12", "12"),
  bisRow("BR", "2026-08", "12.5"),
  bisRow("BR", "2026-09", "13"),
  bisRow("US", "2025-11", "4.25"),
  bisRow("US", "2025-12", "NaN", "M"),
  bisRow("XM", "2026-09", "2"),
].join("\r\n") + "\r\n";

export { bisRow as bisCsvRow, BIS_HEADER as BIS_CSV_HEADER };
