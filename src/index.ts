/*
 * Copyright (c) 2020 Juniper Networks, Inc. All rights reserved.
 */

import fs from "fs";
import path from "path";
import moment from "moment";
import { TestRail, Run } from "testrail-js-api";

type CoverageStat = {
  pct: number;
  total: number;
  covered: number;
  skipped: number;
};

interface AggregatedResult {
  numTotalTests: number;
  numPassedTests: number;
  numPendingTests: number;
  numFailedTests: number;
  numTotalTestSuites: number;
  numPassedTestSuites: number;
  numPendingTestSuites: number;
  numFailedTestSuites: number;
  coverageMap?: {
    getCoverageSummary: () => {
      data: {
        branches: CoverageStat;
        functions: CoverageStat;
        lines: CoverageStat;
        statements: CoverageStat;
      };
    };
  };
}

interface Config<T = number> {
  enabled: boolean;
  host: string;
  user: string;
  apiKey: string;
  projectId: T;
  suiteId: T;
  runName: string;
  runDescription: string;
  coverageCaseId: T;
  branchEnv: string;
  buildNoEnv: string;
  dateFormat: string;
  reference: string;
  runCloseAfterDays: number;
}

const loadJSON = (file: string) => {
  const data = fs.readFileSync(file, { encoding: "utf8" });

  if (data) {
    return JSON.parse(data);
  }
  return {};
};

const prepareConfig = (options: Config): Config => {
  const config: Config<string> = Object.assign(loadJSON(path.join(process.cwd(), ".testrailrc")), options);

  return {
    enabled: process.env.TESTRAIL_ENABLED === "true" || config.enabled || false,
    host: process.env.TESTRAIL_HOST || config.host,
    user: process.env.TESTRAIL_USER || config.user,
    apiKey: process.env.TESTRAIL_API_KEY || config.apiKey,
    projectId: Number((process.env.TESTRAIL_PROJECT_ID || config.projectId || "").replace("P", "").trim()),
    suiteId: Number((process.env.TESTRAIL_SUITE_ID || config.suiteId || "").replace("S", "").trim()),
    coverageCaseId: Number(
      (process.env.TESTRAIL_COVERAGE_CASE_ID || config.coverageCaseId || "").replace("C", "").trim()
    ),
    runName: process.env.TESTRAIL_RUN_NAME || config.runName || "%BRANCH%#%BUILD% - %DATE%",
    runDescription: process.env.TESTRAIL_RUN_DESCRIPTION || config.runDescription,
    reference: process.env.TESTRAIL_REFERENCE || config.reference,
    branchEnv: process.env.TESTRAIL_BRANCH_ENV || config.branchEnv || "BRANCH",
    buildNoEnv: process.env.TESTRAIL_BUILD_NO_ENV || config.buildNoEnv || "BUILD_NUMBER",
    dateFormat: process.env.TESTRAIL_DATE_FORMAT || config.dateFormat || "YYYY-MM-DD HH:mm:ss",
    runCloseAfterDays: Number(process.env.TESTRAIL_RUN_CLOSE_AFTER_DAYS || config.runCloseAfterDays) || 0,
  };
};

const prepareReportName = (config: Config, branch: string, buildNo: string) => {
  const date = moment().format(config.dateFormat);
  return config.runName.replace("%BRANCH%", branch).replace("%BUILD%", buildNo).replace("%DATE%", date);
};

const prepareReference = (config: Config, branch: string, buildNo: string) => {
  return config.reference ? config.reference.replace("%BRANCH%", branch).replace("%BUILD%", buildNo) : "";
};

const prepareReport = (results: AggregatedResult) => {
  const {
    numTotalTests,
    numPassedTests,
    numPendingTests,
    numFailedTests,
    numTotalTestSuites,
    numPassedTestSuites,
    numPendingTestSuites,
    numFailedTestSuites,
  } = results;

  const { branches, functions, lines, statements } = results?.coverageMap?.getCoverageSummary().data || {};

  let report = `# Unit / Component test results:
||| Type       | Total | Passed | Skipped | Failed
|| Test Suites | ${numTotalTestSuites} | ${numPassedTestSuites} | ${numPendingTestSuites} | ${numFailedTestSuites}
|| Tests       | ${numTotalTests} | ${numPassedTests} | ${numPendingTests} | ${numFailedTests}`;
  if (branches && branches.pct && functions && statements && lines) {
    report += `

# Unit tests Coverage:

||| Type      | Percentage | Total | Covered | Skipped
|| functions  | ${functions.pct}% | ${functions.total} | ${functions.covered} | ${functions.skipped}
|| statements | ${statements.pct}% | ${statements.total} | ${statements.covered} | ${statements.skipped}
|| lines      | ${lines.pct}% | ${lines.total} | ${lines.covered} | ${lines.skipped}
|| branches   | ${branches.pct}% | ${branches.total} | ${branches.covered} | ${branches.skipped}`;
  }

  return report;
};

const verifyConfig = (config: Config) => {
  const { enabled, host, user, apiKey, projectId, suiteId, coverageCaseId } = config;
  if (enabled) {
    if (!host) {
      console.log("[TestRail] Hostname was not provided.");
    }

    if (!user || !apiKey) {
      console.log("[TestRail] Username or api key was not provided.");
    }

    if (!projectId) {
      console.log("[TestRail] Project id was not provided.");
    }

    if (!coverageCaseId) {
      console.log("[TestRail] Coverage testcase id was not provided.");
    }

    if (!suiteId) {
      console.log("[TestRail] Suite id was not provided.");
    }

    if (host && user && apiKey && projectId && coverageCaseId && suiteId) {
      return true;
    }
  }

  return false;
};

const throwOnApiError = async <T>(apiResult: Promise<T>): Promise<T> => {
  const { response, value } = (await apiResult) as any;
  if (response.status >= 400) {
    console.error("[TestRail] Error during API request");
    throw {
      url: response.url,
      status: response.status,
      message: value,
    };
  }

  return Promise.resolve(({ response, value } as any) as T);
};

export default class JestTestrailReporter {
  private config: Config;

  private branch: string;
  private buildNo: string;

  constructor(globalConfig: any, options: Config) {
    this.config = prepareConfig(options);

    this.branch = process.env[this.config.branchEnv] || "master";
    this.buildNo = process.env[this.config.buildNoEnv] || "unknown";
  }

  async onRunComplete(contexts: any, results: AggregatedResult) {
    const { host, user, apiKey, projectId, suiteId, coverageCaseId, runDescription } = this.config;

    if (verifyConfig(this.config)) {
      try {
        const testrail = new TestRail(host, user, apiKey);
        const name = prepareReportName(this.config, this.branch, this.buildNo);
        const refs = prepareReference(this.config, this.branch, this.buildNo);
        const report = prepareReport(results);

        // Check for existing not closed runs with the same refs string.
        const { value: runs } = await throwOnApiError(testrail.getRuns(projectId, { is_completed: 0 }));
        const existingRun = runs?.find((run) => run.refs === refs);

        let run: Run | undefined;
        if (existingRun) {
          run = existingRun;
          const { value: tests } = await throwOnApiError(testrail.getTests(existingRun.id));
          const currentCaseIds = tests?.map((test) => test.case_id) || [];
          const additionalDescription = "\n" + runDescription || report;

          await throwOnApiError(
            testrail.updateRun(existingRun.id, {
              description: existingRun.description.replace(additionalDescription, "") + additionalDescription,
              case_ids: [...currentCaseIds, coverageCaseId],
            })
          );

          console.log(`[TestRail] Test run updated successfully: ${name}`);
        } else {
          const payload = {
            suite_id: suiteId,
            include_all: false,
            case_ids: [coverageCaseId],
            name,
            description: runDescription || report,
            refs,
          };

          const { value: newRun } = await throwOnApiError(testrail.addRun(this.config.projectId, payload));
          run = newRun;

          console.log(`[TestRail] Test run added successfully: ${name}`);
        }

        if (run?.id) {
          const { value: resultArray } = await throwOnApiError(
            testrail.addResultsForCases(run.id, [
              {
                case_id: coverageCaseId,
                status_id: results.numFailedTests ? 5 : 1,
                comment: report,
              },
            ])
          );

          if (resultArray.length) {
            console.log("[TestRail] Sending report to TestRail successfull");
          }
        }
      } catch (error) {
        console.error("[TestRail] Sending report to TestRail failed", error);
      }
    }
  }
}
