#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { BackEndStack } from '../lib/back-end-stack';

const app = new cdk.App();
new BackEndStack(app, 'BackEndStack');
