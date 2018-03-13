"use strict";

const assert = require('assert');
const moment = require('moment');
const express = require('express');
const app = express();

const Compute = require('@google-cloud/compute');
const compute = new Compute();

app.get('/', (req, res) => {
	res.status(404).end();
});

app.get('/cron/hourly', async (req, res) => {
	if (typeof req.headers['x-appengine-cron'] === 'undefined' || req.headers['x-appengine-cron'] !== 'true') {
		res.status(404).end();
	} else {
		res.status(200).type('text/plain');

		await rotateBackup('hourly', 'HHmm', 24);

		res.end();
	}
});

app.get('/cron/daily', async (req, res) => {
	if (typeof req.headers['x-appengine-cron'] === 'undefined' || req.headers['x-appengine-cron'] !== 'true') {
		res.status(404).end();
	} else {
		res.status(200).type('text/plain');

		await rotateBackup('daily', 'YYYYMMDD', 7);

		res.end();
	}
});

app.get('/cron/weekly', async (req, res) => {
	if (typeof req.headers['x-appengine-cron'] === 'undefined' || req.headers['x-appengine-cron'] !== 'true') {
		res.status(404).end();
	} else {
		res.status(200).type('text/plain');

		await rotateBackup('weekly', 'YYYYWW', 4);

		res.end();
	}
});

app.get('/cron/monthly', async (req, res) => {
	if (typeof req.headers['x-appengine-cron'] === 'undefined' || req.headers['x-appengine-cron'] !== 'true') {
		res.status(404).end();
	} else {
		res.status(200).type('text/plain');

		await rotateBackup('monthly', 'YYYYMM', 12);

		res.end();
	}
});

if (module === require.main) {
	const server = app.listen(process.env.PORT || 8080, () => {
		const port = server.address().port;
		console.log(`App listening on port ${port}.`);
	});
}

module.exports = app;

async function rotateBackup(suffix, format, keep) {
	assert(typeof suffix === 'string' && suffix != '');
	assert(typeof format === 'string' && format != '');
	assert(typeof keep === 'number' && keep >= 1);

	// Fetch all disk for this project
	const disks = await fetchDisks();
	for (let disk of disks) {
		// Fetch all snapshot for this disk and type
		let snaps = await fetchSnapshots(`(sourceDiskId eq "${disk.metadata.id}") (name eq ^${disk.id}-${suffix}.*)`);

		// Create new snapshot
		const name = `${disk.id}-${suffix}-${moment().format(format)}`;
		console.log(`Creating snapshot ${name}`);
		const [snap, op, resp] = await disk.createSnapshot(name);

		// Add snapshot to list
		snaps.push(snap);

		// Sort by date using the name
		snaps = snaps.sort((a, b) => a.id.localeCompare(b.id)).reverse();

		// Remove extra snapshots
		for (let i = keep, l = snaps.length; i < l; ++i) {
			console.log(`Deleting snapshot ${snaps[i].id}`);
			const [op, resp] = await snaps[i].delete();
		}
	}
}

function fetchDisks() {
	return new Promise((resolve, reject) => {
		const disks = [];

		try {
			compute.getDisksStream()
				.on('error', (err) => reject(err))
				.on('data', (disk) => {
					disks.push(disk);
				})
				.on('end', () => {
					resolve(disks);
				});
		} catch (err) {
			reject(err);
		}
	});
}

function fetchSnapshots(filter) {
	return new Promise((resolve, reject) => {
		const snaps = [];

		try {
			compute.getSnapshotsStream({ filter })
				.on('error', (err) => {
					reject(err);
				})
				.on('data', (snap) => {
					snaps.push(snap);
				})
				.on('end', () => {
					resolve(snaps);
				});
		} catch (err) {
			reject(err);
		}
	});
}