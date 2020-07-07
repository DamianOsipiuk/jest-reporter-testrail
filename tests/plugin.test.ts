import { readFileSync } from "fs";
import fetch from "node-fetch";

import JestTestrailReporter from "../src/index";

jest.mock("fs");
jest.mock("node-fetch", () => jest.fn());
const { Response } = jest.requireActual("node-fetch");
const fetchMock: jest.MockedFunction<typeof fetch> = fetch as any;
const fsMock: jest.MockedFunction<typeof readFileSync> = readFileSync as any;
const logMock = jest.fn();
const errorMock = jest.fn();

console.log = logMock;
console.error = errorMock;

describe("Reporter Plugin", () => {
  const config: any = {
    enabled: true,
    host: "host",
    user: "user",
    apiKey: "apiKey",
    projectId: "P1",
    suiteId: "S2",
    coverageCaseId: "C123",
    reference: "refs",
  };

  const aggregatedResults = {
    numTotalTests: 6,
    numPassedTests: 3,
    numPendingTests: 1,
    numFailedTests: 2,
    numTotalTestSuites: 3,
    numPassedTestSuites: 1,
    numPendingTestSuites: 1,
    numFailedTestSuites: 1,
    coverageMap: {
      getCoverageSummary: () => ({
        data: {
          branches: {
            total: 100,
            pct: 100,
            covered: 100,
            skipped: 0,
          },
          functions: {
            total: 100,
            pct: 100,
            covered: 100,
            skipped: 0,
          },
          lines: {
            total: 100,
            pct: 100,
            covered: 100,
            skipped: 0,
          },
          statements: {
            total: 100,
            pct: 100,
            covered: 100,
            skipped: 0,
          },
        },
      }),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockRestore();
  });

  test("disabled plugin", async () => {
    const disabledConfig: any = {
      enabled: false,
    };

    const plugin = new JestTestrailReporter({}, disabledConfig);
    await plugin.onRunComplete({}, aggregatedResults);
    expect(logMock).toBeCalledTimes(0);
    expect(errorMock).toBeCalledTimes(0);
    expect(fetchMock).toBeCalledTimes(0);
  });

  test("required config not provided", async () => {
    const config: any = {
      enabled: true,
    };

    const plugin = new JestTestrailReporter({}, config);
    await plugin.onRunComplete({}, aggregatedResults);
    expect(logMock).toBeCalledTimes(5);
    expect(errorMock).toBeCalledTimes(0);
    expect(fetchMock).toBeCalledTimes(0);
  });

  test("test file config", async () => {
    const noConfig: any = {};
    fsMock.mockReturnValue(JSON.stringify({ enabled: true }));
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "error message" }), {
        status: 400,
        url: "mock/url",
      })
    );

    const plugin = new JestTestrailReporter({}, noConfig);
    await plugin.onRunComplete({}, aggregatedResults);
    expect(logMock).toBeCalledTimes(5);
    expect(logMock).toHaveBeenNthCalledWith(2, "[TestRail] Username or api key was not provided.");
  });

  test("update run", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 123, refs: "refs", description: "" }]), {
          status: 200,
          url: "get/run",
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ case_id: 234 }]), {
          status: 200,
          url: "get/test",
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 123, refs: "refs" }), {
          status: 200,
          url: "update/run",
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{}]), {
          status: 200,
          url: "add/results",
        })
      );

    const plugin = new JestTestrailReporter({}, config);
    await plugin.onRunComplete({}, aggregatedResults);
    expect(logMock).toBeCalledTimes(2);
    expect(errorMock).toBeCalledTimes(0);
    expect(fetchMock).toBeCalledTimes(4);
    expect(logMock).toHaveBeenNthCalledWith(2, "[TestRail] Sending report to TestRail successfull");
  });

  test("create run", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 123, refs: "", description: "" }]), {
          status: 200,
          url: "get/run",
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 123, refs: "refs" }), {
          status: 200,
          url: "add/run",
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{}]), {
          status: 200,
          url: "add/results",
        })
      );

    const plugin = new JestTestrailReporter({}, config);
    await plugin.onRunComplete({}, aggregatedResults);
    expect(logMock).toBeCalledTimes(2);
    expect(errorMock).toBeCalledTimes(0);
    expect(fetchMock).toBeCalledTimes(3);
    expect(logMock).toHaveBeenNthCalledWith(2, "[TestRail] Sending report to TestRail successfull");
  });

  test("error on runs fetch", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "error message" }), {
        status: 400,
        url: "mock/url",
      })
    );

    const plugin = new JestTestrailReporter({}, config);
    await plugin.onRunComplete({}, aggregatedResults);
    expect(logMock).toBeCalledTimes(0);
    expect(errorMock).toBeCalledTimes(2);
    expect(errorMock).toHaveBeenNthCalledWith(2, "[TestRail] Sending report to TestRail failed", {
      message: { error: "error message" },
      status: 400,
      url: "mock/url",
    });

    expect(fetchMock).toBeCalledTimes(1);
  });

  test("error on runs fetch", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "error message" }), {
        status: 400,
        url: "mock/url",
      })
    );

    const plugin = new JestTestrailReporter({}, config);
    await plugin.onRunComplete({}, aggregatedResults);
    expect(logMock).toBeCalledTimes(0);
    expect(errorMock).toBeCalledTimes(2);
    expect(errorMock).toHaveBeenNthCalledWith(2, "[TestRail] Sending report to TestRail failed", {
      message: { error: "error message" },
      status: 400,
      url: "mock/url",
    });

    expect(fetchMock).toBeCalledTimes(1);
  });
});
