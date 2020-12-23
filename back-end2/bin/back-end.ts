#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import 'source-map-support/register';
import { BackEndStack } from '../lib/back-end-stack';

const app = new cdk.App();
new BackEndStack(app, 'BackEndStack');
