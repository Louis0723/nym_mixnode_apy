#!/usr/bin/env bash
curl https://validator.nymtech.net/api/v1/mixnodes/detailed -o mixnode.json
curl https://validator.nymtech.net/api/v1/epoch/current -o current.json
curl https://validator.nymtech.net/api/v1/epoch/reward_params -o reward_params.json

yarn
node index.js
