import { createServer } from "node:http";

const PKG_PASSED = {
  Id: 4001, Label: "1A4FF0100000022000000101", Quantity: 1250.5,
  UnitOfMeasureName: "Grams",
  Item: { Name: "Bulk THC Distillate", ProductCategoryName: "Concentrate" },
  PackagedDate: "2026-07-14", LabTestingState: "TestPassed",
  IsFinished: false, IsOnHold: false,
};
const PKG_PENDING = {
  Id: 4002, Label: "1A4FF0100000022000000102", Quantity: 890.0,
  UnitOfMeasureName: "Grams",
  Item: { Name: "Crude Extract", ProductCategoryName: "Concentrate" },
  PackagedDate: "2026-07-02", LabTestingState: "SubmittedForTesting",
  IsFinished: false, IsOnHold: true,
};
const LABS: Record<number, unknown[]> = {
  4001: [
    { PackageId: 4001, LabTestResultId: 9001, LabFacilityName: "OK Analytics",
      TestTypeName: "Potency - Total THC (%)", TestPassed: true,
      TestResultLevel: 81.4, TestPerformedDate: "2026-07-12" },
    { PackageId: 4001, LabTestResultId: 9002, LabFacilityName: "OK Analytics",
      TestTypeName: "Residual Solvents - Butane (ppm)", TestPassed: true,
      TestResultLevel: 12.0, TestPerformedDate: "2026-07-12" },
  ],
  4002: [],
};

/** Start a mock METRC instance; returns its base URL. */
export function startMockMetrc(port = 8756): Promise<string> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };

    const pkgMatch = url.pathname.match(/^\/packages\/v2\/(1A\w+)$/);
    if (pkgMatch) {
      const found = [PKG_PASSED, PKG_PENDING].find((p) => p.Label === pkgMatch[1]);
      return found ? send(200, found) : send(404, { Message: "Package not found." });
    }
    if (url.pathname === "/labtests/v2/results") {
      const id = Number(url.searchParams.get("packageId"));
      return send(200, LABS[id] ?? []);
    }
    send(404, { Message: `Mock has no route for ${url.pathname}` });
  });
  return new Promise((resolve) =>
    server.listen(port, () => resolve(`http://127.0.0.1:${port}`))
  );
}