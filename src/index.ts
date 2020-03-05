/*
 * Copyright (c) 2020 Juniper Networks, Inc. All rights reserved.
 */

import fs from "fs";
import path from "path";
import moment from "moment";
import { TestRail, Run } from "testrail-js-api";
import { AggregatedResult } from "@jest/test-result";

interface Config<T = number> {
  enabled: boolean;
  host: string;
  user: string;
  apiKey: string;
  projectId: T;
  planId: T;
  suiteId: T;
  runName: string;
  runDescription: string;
  coverageCaseId: T;
  branchEnv: string;
  buildNoEnv: string;
  dateFormat: string;
  reference: string;
}

const loadJSON = (file: string) => {
  const data = fs.readFileSync(file, { encoding: "utf8" });

  return JSON.parse(data);
};

const prepareConfig = (options: Config): Config => {
  const config: Config<string> = Object.assign(loadJSON(path.join(process.cwd(), ".testrailrc")), options);

  return {
    enabled: process.env.TESTRAIL_ENABLED === "true" || config.enabled || false,
    host: process.env.TESTRAIL_HOST || config.host,
    user: process.env.TESTRAIL_USER || config.user,
    apiKey: process.env.TESTRAIL_API_KEY || config.apiKey,
    projectId: Number((process.env.TESTRAIL_PROJECT_ID || config.projectId || "").replace("P", "").trim()),
    planId: Number((process.env.TESTRAIL_PLAN_ID || config.planId || "").replace("R", "").trim()),
    suiteId: Number((process.env.TESTRAIL_SUITE_ID || config.suiteId || "").replace("S", "").trim()),
    coverageCaseId: Number((process.env.TESTRAIL_COVERAGE_CASE_ID || config.coverageCaseId).replace("C", "").trim()),
    runName: process.env.TESTRAIL_RUN_NAME || config.runName || "%BRANCH%#%BUILD% - %DATE%",
    runDescription: process.env.TESTRAIL_RUN_DESCRIPTION || config.runDescription,
    reference: process.env.TESTRAIL_REFERENCE || config.reference || "%BRANCH%#%BUILD%",
    branchEnv: process.env.BRANCH_ENV || config.branchEnv || "BRANCH",
    buildNoEnv: process.env.BUILD_NO_ENV || config.buildNoEnv || "BUILD_NUMBER",
    dateFormat: process.env.DATE_FORMAT || config.dateFormat || "YYYY-MM-DD HH:mm:ss",
  };
};

const prepareReportName = (config: Config, branch: string, buildNo: string) => {
  const date = moment().format(config.dateFormat);
  return config.runName
    .replace("%BRANCH%", branch)
    .replace("%BUILD%", buildNo)
    .replace("%DATE%", date);
};

const prepareReference = (config: Config, branch: string, buildNo: string) => {
  return config.reference.replace("%BRANCH%", branch).replace("%BUILD%", buildNo);
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

export class TestrailReporter {
  private config: Config;

  private branch: string;
  private buildNo: string;

  constructor(globalConfig: any, options: Config) {
    this.config = prepareConfig(options);

    this.branch = process.env[this.config.branchEnv] || "master";
    this.buildNo = process.env[this.config.buildNoEnv] || "unknown";
  }

  async onRunComplete(contexts: any, results: AggregatedResult) {
    const { enabled, host, user, apiKey, projectId, planId, suiteId, coverageCaseId } = this.config;

    if (!user || !apiKey) {
      console.info("[TestRail] Username or api key was not provided.");
    }

    if (!projectId) {
      console.info("[TestRail] Project id was not provided.");
    }

    if (!coverageCaseId) {
      console.info("[TestRail] Coverage testcase id was not provided.");
    }

    if (!suiteId) {
      console.info("[TestRail] Suite id was not provided.");
    }

    if (enabled && host && user && apiKey && projectId && coverageCaseId && suiteId) {
      const testrail = new TestRail(host, user, apiKey);
      const name = prepareReportName(this.config, this.branch, this.buildNo);
      const refs = prepareReference(this.config, this.branch, this.buildNo);
      const description = prepareReport(results);

      const runPayload = {
        suite_id: suiteId,
        include_all: false,
        case_ids: [coverageCaseId],
        name,
        description,
        refs,
      };

      let run: Run | undefined;
      if (planId) {
        const { response, value: planEntry } = await testrail.addPlanEntry(planId, runPayload);
        if (planEntry?.runs?.length) {
          run = planEntry.runs[0];
        } else {
          console.error("[TestRail] Plan entry creation failed", response);
        }
      } else {
        const { response, value: runEntry } = await testrail.addRun(projectId, runPayload);
        if (runEntry?.id) {
          run = runEntry;
        } else {
          console.error("[TestRail] Run creation failed", response);
        }
      }

      if (run?.id) {
        const { response, value: resultArray } = await testrail.addResultsForCases(run.id, [
          {
            case_id: coverageCaseId,
            status_id: results.numFailedTests ? 5 : 1,
            comment: description,
          },
        ]);

        if (resultArray.length) {
            console.info("[TestRail] Sending report to TestRail successfull");
          } else {
            console.error("[TestRail] Sending report to TestRail failed", response);
          }
      }
    }
  }
}
