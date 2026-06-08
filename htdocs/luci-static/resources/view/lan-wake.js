'use strict';
'require view';
'require rpc';
'require ui';

var callList = rpc.declare({ object: 'lan-wake', method: 'list_devices' });
var callAdd = rpc.declare({ object: 'lan-wake', method: 'add_device', params: [ 'payload' ] });
var callUpdate = rpc.declare({ object: 'lan-wake', method: 'update_device', params: [ 'payload' ] });
var callDelete = rpc.declare({ object: 'lan-wake', method: 'delete_device', params: [ 'payload' ] });
var callWake = rpc.declare({ object: 'lan-wake', method: 'wake_device', params: [ 'payload' ] });
var callCheck = rpc.declare({ object: 'lan-wake', method: 'check_status', params: [ 'payload' ] });
var callCheckAll = rpc.declare({ object: 'lan-wake', method: 'check_all_status' });
var callDeps = rpc.declare({ object: 'lan-wake', method: 'get_dependencies' });
var callSettings = rpc.declare({ object: 'lan-wake', method: 'get_settings' });
var callUpdateSettings = rpc.declare({ object: 'lan-wake', method: 'update_settings', params: [ 'payload' ] });
var callUpdateOrder = rpc.declare({ object: 'lan-wake', method: 'update_order', params: [ 'payload' ] });
var callScanDevices = rpc.declare({ object: 'lan-wake', method: 'scan_devices' });
var callStartScan = rpc.declare({ object: 'lan-wake', method: 'start_scan_devices' });
var callGetScan = rpc.declare({ object: 'lan-wake', method: 'get_scan_devices', params: [ 'payload' ] });

var state = {
	devices: [],
	settings: {},
	deps: {},
	group: '',
	status: '',
	query: '',
	queryDraft: '',
	searchTimer: null,
	view: 'card',
	timer: null,
	wakeTimer: null,
	uiTimer: null,
	refreshing: false,
	draggingId: null,
	backendRetry: null,
	backendRetryCount: 0,
	modalBlurTimer: null,
	scanning: false
};

var statusMeta = {
	online: { text: '在线', cls: 'online' },
	unknown: { text: '未知', cls: 'unknown' },
	offline: { text: '离线', cls: 'offline' },
	waking: { text: '唤醒中', cls: 'waking' },
	unchecked: { text: '未检测', cls: 'unchecked' }
};

var iconMap = {
	nas: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMjQgMjQiPgoJPHBhdGggZD0iTTAgMGgyNHYyNEgweiIgZmlsbD0ibm9uZSIgLz4KCTxwYXRoIGZpbGw9ImN1cnJlbnRDb2xvciIgZD0iTTQgNWMtMS4xMSAwLTIgLjg5LTIgMnYxMGMwIDEuMTEuODkgMiAyIDJoMTZjMS4xMSAwIDItLjg5IDItMlY3YzAtMS4xMS0uODktMi0yLTJ6bS41IDJhMSAxIDAgMCAxIDEgMWExIDEgMCAwIDEtMSAxYTEgMSAwIDAgMS0xLTFhMSAxIDAgMCAxIDEtMU03IDdoMTN2MTBIN3ptMSAxdjhoM1Y4em00IDB2OGgzVjh6bTQgMHY4aDNWOHpNOSA5aDF2MUg5em00IDBoMXYxaC0xem00IDBoMXYxaC0xeiIgLz4KPC9zdmc+Cg==',
	router: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgNDggNDgiPgoJPHBhdGggZD0iTTAgMGg0OHY0OEgweiIgZmlsbD0ibm9uZSIgLz4KCTxnIGZpbGw9Im5vbmUiPgoJCTxyZWN0IHdpZHRoPSI0MCIgaGVpZ2h0PSIxNCIgeD0iNCIgeT0iMjgiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS13aWR0aD0iNCIgcng9IjIiIC8+CgkJPHBhdGggc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLXdpZHRoPSI0IiBkPSJNMTQgMzVoOCIgLz4KCQk8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiB4PSIzMCIgeT0iMzMiIGZpbGw9ImN1cnJlbnRDb2xvciIgcng9IjIiIC8+CgkJPHBhdGggc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLXdpZHRoPSI0IiBkPSJNMTIgMjhWOG0yNCAyMFY4IiAvPgoJPC9nPgo8L3N2Zz4K',
	server: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMjQgMjQiPgoJPHBhdGggZD0iTTAgMGgyNHYyNEgweiIgZmlsbD0ibm9uZSIgLz4KCTxwYXRoIGZpbGw9ImN1cnJlbnRDb2xvciIgZD0iTTE1IDE3YTEgMSAwIDEgMCAxIDFhMSAxIDAgMCAwLTEtMW0tNiAwSDZhMSAxIDAgMCAwIDAgMmgzYTEgMSAwIDAgMCAwLTJtOSAwYTEgMSAwIDEgMCAxIDFhMSAxIDAgMCAwLTEtMW0tMy02YTEgMSAwIDEgMCAxIDFhMSAxIDAgMCAwLTEtMW0tNiAwSDZhMSAxIDAgMCAwIDAgMmgzYTEgMSAwIDAgMCAwLTJtOS02YTEgMSAwIDEgMCAxIDFhMSAxIDAgMCAwLTEtMW0wIDZhMSAxIDAgMSAwIDEgMWExIDEgMCAwIDAtMS0xbTQtNmEzIDMgMCAwIDAtMy0zSDVhMyAzIDAgMCAwLTMgM3YyYTMgMyAwIDAgMCAuNzggMkEzIDMgMCAwIDAgMiAxMXYyYTMgMyAwIDAgMCAuNzggMkEzIDMgMCAwIDAgMiAxN3YyYTMgMyAwIDAgMCAzIDNoMTRhMyAzIDAgMCAwIDMtM3YtMmEzIDMgMCAwIDAtLjc4LTJhMyAzIDAgMCAwIC43OC0ydi0yYTMgMyAwIDAgMC0uNzgtMkEzIDMgMCAwIDAgMjIgN1ptLTIgMTRhMSAxIDAgMCAxLTEgMUg1YTEgMSAwIDAgMS0xLTF2LTJhMSAxIDAgMCAxIDEtMWgxNGExIDEgMCAwIDEgMSAxWm0wLTZhMSAxIDAgMCAxLTEgMUg1YTEgMSAwIDAgMS0xLTF2LTJhMSAxIDAgMCAxIDEtMWgxNGExIDEgMCAwIDEgMSAxWm0wLTZhMSAxIDAgMCAxLTEgMUg1YTEgMSAwIDAgMS0xLTFWNWExIDEgMCAwIDEgMS0xaDE0YTEgMSAwIDAgMSAxIDFabS01LTJhMSAxIDAgMSAwIDEgMWExIDEgMCAwIDAtMS0xTTkgNUg2YTEgMSAwIDAgMCAwIDJoM2ExIDEgMCAwIDAgMC0yIiAvPgo8L3N2Zz4K',
	vm: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMjQgMjQiPgoJPHBhdGggZD0iTTAgMGgyNHYyNEgweiIgZmlsbD0ibm9uZSIgLz4KCTxwYXRoIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiIGQ9Ik0xIDIzaDEzVjEwSDF6bTktNGgxM1Y2SDEwem0tNS01aDEzVjFINXoiIC8+Cjwvc3ZnPgo=',
	pc: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgNTEyIDUxMiI+Cgk8cGF0aCBkPSJNMCAwaDUxMnY1MTJIMHoiIGZpbGw9Im5vbmUiIC8+Cgk8cGF0aCBmaWxsPSJjdXJyZW50Q29sb3IiIGQ9Ik0yOS42NSAxMTcuODl2Mjc2LjIyaDEyNC42MlYxMTcuODl6bTkwLjU1IDI1My4xNmExMSAxMSAwIDEgMSAxMS0xMWExMSAxMSAwIDAgMS0xMSAxMW0xOC0xODkuMTZINDUuNTZ2LTE2aDkyLjYzdjE2em0wLTMySDQ1LjU2di0xNmg5Mi42M3YxNnptMTUzIDE4OC41MWg3My4xdjM5LjcxaDQxLjc0djE2SDI0OS40OHYtMTZoNDEuNzRWMzM4LjR6bS0xMTgtMjIwLjUxVjMyMi40aDMwOS4xNVYxMTcuODlIMTczLjE5ek00NjYuMzUgMzA2LjRIMTg5LjE5VjEzMy44OWgyNzcuMTZ6IiAvPgo8L3N2Zz4K',
	laptop: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMjQgMjQiPgoJPHBhdGggZD0iTTAgMGgyNHYyNEgweiIgZmlsbD0ibm9uZSIgLz4KCTxwYXRoIGZpbGw9ImN1cnJlbnRDb2xvciIgZD0iTTIwIDE4YzEuMSAwIDItLjkgMi0yVjZjMC0xLjEtLjktMi0yLTJINGMtMS4xIDAtMiAuOS0yIDJ2MTBjMCAxLjEuOSAyIDIgMkgxYy0uNTUgMC0xIC40NS0xIDFzLjQ1IDEgMSAxaDIyYy41NSAwIDEtLjQ1IDEtMXMtLjQ1LTEtMS0xek01IDZoMTRjLjU1IDAgMSAuNDUgMSAxdjhjMCAuNTUtLjQ1IDEtMSAxSDVjLS41NSAwLTEtLjQ1LTEtMVY3YzAtLjU1LjQ1LTEgMS0xIiAvPgo8L3N2Zz4K',
	mini: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMTYgMTYiPgoJPHBhdGggZD0iTTAgMGgxNnYxNkgweiIgZmlsbD0ibm9uZSIgLz4KCTxwYXRoIGZpbGw9ImN1cnJlbnRDb2xvciIgZD0iTTEgNmExIDEgMCAwIDAtMSAxdjNhMSAxIDAgMCAwIDEgMWgxNGExIDEgMCAwIDAgMS0xVjdhMSAxIDAgMCAwLTEtMXptMTEuNSAxYS41LjUgMCAxIDEgMCAxYS41LjUgMCAwIDEgMC0xbTIgMGEuNS41IDAgMSAxIDAgMWEuNS41IDAgMCAxIDAtMU0xIDcuNWEuNS41IDAgMCAxIC41LS41aDVhLjUuNSAwIDAgMSAwIDFoLTVhLjUuNSAwIDAgMS0uNS0uNU0xLjI1IDloNS41YS4yNS4yNSAwIDAgMSAwIC41aC01LjVhLjI1LjI1IDAgMCAxIDAtLjUiIC8+Cjwvc3ZnPgo=',
	game: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMzIgMzIiPgoJPHBhdGggZD0iTTAgMGgzMnYzMkgweiIgZmlsbD0ibm9uZSIgLz4KCTxwYXRoIGZpbGw9ImN1cnJlbnRDb2xvciIgZD0iTTcuNTEgMjZhNS41IDUuNSAwIDAgMS0xLjQ0LS4xOUE1LjYgNS42IDAgMCAxIDIuMTkgMTlsMi4zMy04Ljg0YTUuNTQgNS41NCAwIDAgMSAyLjU5LTMuNDNhNS40MyA1LjQzIDAgMCAxIDQuMTUtLjU0QTUuNTIgNS41MiAwIDAgMSAxNC43IDloMi42YTUuNSA1LjUgMCAwIDEgMy40NC0yLjgxYTUuNDMgNS40MyAwIDAgMSA0LjE1LjU0YTUuNTcgNS41NyAwIDAgMSAyLjU5IDMuNDFMMjkuODEgMTlhNS42IDUuNiAwIDAgMS0zLjg5IDYuODNhNS40MyA1LjQzIDAgMCAxLTQuMTUtLjU0YTUuNTQgNS41NCAwIDAgMS0yLjU5LTMuNDFMMTkgMjFoLTZsLS4yMy44NmE1LjU0IDUuNTQgMCAwIDEtMi41OSAzLjQxYTUuNDYgNS40NiAwIDAgMS0yLjY3LjczTTkuODMgOGEzLjUgMy41IDAgMCAwLTEuNzIuNDZhMy42IDMuNiAwIDAgMC0xLjY2IDIuMTlsLTIuMzMgOC44NGEzLjYgMy42IDAgMCAwIDIuNDggNC4zOWEzLjQzIDMuNDMgMCAwIDAgMi42Mi0uMzRhMy41NCAzLjU0IDAgMCAwIDEuNjYtMi4xOUwxMS41IDE5aDlsLjYxIDIuMzVhMy41OCAzLjU4IDAgMCAwIDEuNjYgMi4xOWEzLjQ2IDMuNDYgMCAwIDAgMi42My4zNGEzLjU4IDMuNTggMCAwIDAgMi40Ny00LjM5bC0yLjMzLTguODRhMy41NSAzLjU1IDAgMCAwLTEuNjUtMi4xOWEzLjQ2IDMuNDYgMCAwIDAtMi42My0uMzRhMy41NSAzLjU1IDAgMCAwLTIuMzcgMi4yMmwtLjI0LjY2aC01LjNsLS4yNC0uNjZhMy41NiAzLjU2IDAgMCAwLTIuMzgtMi4yMmEzLjUgMy41IDAgMCAwLS45LS4xMiIgLz4KCTxwYXRoIGZpbGw9ImN1cnJlbnRDb2xvciIgZD0iTTEwIDE2YTIgMiAwIDEgMSAyLTJhMiAyIDAgMCAxLTIgMm0wLTIiIC8+Cgk8Y2lyY2xlIGN4PSIyMiIgY3k9IjEyIiByPSIxIiBmaWxsPSJjdXJyZW50Q29sb3IiIC8+Cgk8Y2lyY2xlIGN4PSIyMiIgY3k9IjE2IiByPSIxIiBmaWxsPSJjdXJyZW50Q29sb3IiIC8+Cgk8Y2lyY2xlIGN4PSIyMCIgY3k9IjE0IiByPSIxIiBmaWxsPSJjdXJyZW50Q29sb3IiIC8+Cgk8Y2lyY2xlIGN4PSIyNCIgY3k9IjE0IiByPSIxIiBmaWxsPSJjdXJyZW50Q29sb3IiIC8+Cjwvc3ZnPgo=',
	television: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMjQgMjQiPgoJPHBhdGggZD0iTTAgMGgyNHYyNEgweiIgZmlsbD0ibm9uZSIgLz4KCTxwYXRoIGZpbGw9ImN1cnJlbnRDb2xvciIgZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNMy4yIDUuMnYxMi42aDE3LjZWNS4yek0yIDVhMSAxIDAgMCAxIDEtMWgxOGExIDEgMCAwIDEgMSAxdjEzYTEgMSAwIDAgMS0xIDFIM2ExIDEgMCAwIDEtMS0xem02IDE1LjljMC0uMzMxLjI2Ni0uNi42MDEtLjZIMTUuNGMuMzMyIDAgLjYwMS4yNzguNjAxLjZ2LjZIOHptMy42NjUtMTIuMDA0SDkuODFWMTVIOC43MTZWOC44OTZINi41NTh2LS45NDJoNS45NThsMS45MTkgNS44MTZoLjAyOWwxLjkyNC01LjgxNmgxLjE2N0wxNS4wNCAxNWgtMS4xOTZ6IiAvPgo8L3N2Zz4K',
	tv: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMjQgMjQiPgoJPHBhdGggZD0iTTAgMGgyNHYyNEgweiIgZmlsbD0ibm9uZSIgLz4KCTxwYXRoIGZpbGw9ImN1cnJlbnRDb2xvciIgZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNMy4yIDUuMnYxMi42aDE3LjZWNS4yek0yIDVhMSAxIDAgMCAxIDEtMWgxOGExIDEgMCAwIDEgMSAxdjEzYTEgMSAwIDAgMS0xIDFIM2ExIDEgMCAwIDEtMS0xem02IDE1LjljMC0uMzMxLjI2Ni0uNi42MDEtLjZIMTUuNGMuMzMyIDAgLjYwMS4yNzguNjAxLjZ2LjZIOHptMy42NjUtMTIuMDA0SDkuODFWMTVIOC43MTZWOC44OTZINi41NTh2LS45NDJoNS45NThsMS45MTkgNS44MTZoLjAyOWwxLjkyNC01LjgxNmgxLjE2N0wxNS4wNCAxNWgtMS4xOTZ6IiAvPgo8L3N2Zz4K',
	tvbox: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMjQgMjQiPgoJPHBhdGggZD0iTTAgMGgyNHYyNEgweiIgZmlsbD0ibm9uZSIgLz4KCTxwYXRoIGZpbGw9ImN1cnJlbnRDb2xvciIgZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNMy4yIDUuMnYxMi42aDE3LjZWNS4yek0yIDVhMSAxIDAgMCAxIDEtMWgxOGExIDEgMCAwIDEgMSAxdjEzYTEgMSAwIDAgMS0xIDFIM2ExIDEgMCAwIDEtMS0xem02IDE1LjljMC0uMzMxLjI2Ni0uNi42MDEtLjZIMTUuNGMuMzMyIDAgLjYwMS4yNzguNjAxLjZ2LjZIOHptMy42NjUtMTIuMDA0SDkuODFWMTVIOC43MTZWOC44OTZINi41NTh2LS45NDJoNS45NThsMS45MTkgNS44MTZoLjAyOWwxLjkyNC01LjgxNmgxLjE2N0wxNS4wNCAxNWgtMS4xOTZ6IiAvPgo8L3N2Zz4K',
	iot: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMjQgMjQiPgoJPHBhdGggZD0iTTAgMGgyNHYyNEgweiIgZmlsbD0ibm9uZSIgLz4KCTxwYXRoIGZpbGw9ImN1cnJlbnRDb2xvciIgZD0iTTEyIDNMMiAxMmgzdjhoMTR2LThoM3ptMCA1LjVjMi4zNCAwIDQuNDYuOTMgNiAyLjQ0bC0xLjIgMS4xOGE2LjggNi44IDAgMCAwLTQuOC0xLjk1Yy0xLjg4IDAtMy41OC43NC00LjggMS45NUw2IDEwLjk0YTguNTQgOC41NCAwIDAgMSA2LTIuNDRtMCAzLjMzYzEuNCAwIDIuNjcuNTYgMy42IDEuNDdsLTEuMiAxLjE3YTMuNCAzLjQgMCAwIDAtMi40LS45N2MtLjk0IDAtMS43OS4zNy0yLjQuOTdMOC40IDEzLjNhNS4xMyA1LjEzIDAgMCAxIDMuNi0xLjQ3bTAgMy4zNGMuOTQgMCAxLjcuNzQgMS43IDEuNjZzLS43NiAxLjY3LTEuNyAxLjY3cy0xLjctLjc1LTEuNy0xLjY3cy43Ni0xLjY2IDEuNy0xLjY2IiAvPgo8L3N2Zz4K',
	smart_home: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMjQgMjQiPgoJPHBhdGggZD0iTTAgMGgyNHYyNEgweiIgZmlsbD0ibm9uZSIgLz4KCTxwYXRoIGZpbGw9ImN1cnJlbnRDb2xvciIgZD0iTTEyIDNMMiAxMmgzdjhoMTR2LThoM3ptMCA1LjVjMi4zNCAwIDQuNDYuOTMgNiAyLjQ0bC0xLjIgMS4xOGE2LjggNi44IDAgMCAwLTQuOC0xLjk1Yy0xLjg4IDAtMy41OC43NC00LjggMS45NUw2IDEwLjk0YTguNTQgOC41NCAwIDAgMSA2LTIuNDRtMCAzLjMzYzEuNCAwIDIuNjcuNTYgMy42IDEuNDdsLTEuMiAxLjE3YTMuNCAzLjQgMCAwIDAtMi40LS45N2MtLjk0IDAtMS43OS4zNy0yLjQuOTdMOC40IDEzLjNhNS4xMyA1LjEzIDAgMCAxIDMuNi0xLjQ3bTAgMy4zNGMuOTQgMCAxLjcuNzQgMS43IDEuNjZzLS43NiAxLjY3LTEuNyAxLjY3cy0xLjctLjc1LTEuNy0xLjY3cy43Ni0xLjY2IDEuNy0xLjY2IiAvPgo8L3N2Zz4K',
	devboard: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMTYgMTYiPgoJPHBhdGggZD0iTTAgMGgxNnYxNkgweiIgZmlsbD0ibm9uZSIgLz4KCTxnIGZpbGw9ImN1cnJlbnRDb2xvciI+CgkJPHBhdGggZD0iTTExLjUgMmEuNS41IDAgMCAxIC41LjV2N2EuNS41IDAgMCAxLTEgMHYtN2EuNS41IDAgMCAxIC41LS41bTIgMGEuNS41IDAgMCAxIC41LjV2N2EuNS41IDAgMCAxLTEgMHYtN2EuNS41IDAgMCAxIC41LS41bS0xMCA4YS41LjUgMCAwIDAgMCAxaDZhLjUuNSAwIDAgMCAwLTF6bTAgMmEuNS41IDAgMCAwIDAgMWg2YS41LjUgMCAwIDAgMC0xek01IDNhMSAxIDAgMCAwLTEgMWgtLjVhLjUuNSAwIDAgMCAwIDFINHYxaC0uNWEuNS41IDAgMCAwIDAgMUg0YTEgMSAwIDAgMCAxIDF2LjVhLjUuNSAwIDAgMCAxIDBWOGgxdi41YS41LjUgMCAwIDAgMSAwVjhhMSAxIDAgMCAwIDEtMWguNWEuNS41IDAgMCAwIDAtMUg5VjVoLjVhLjUuNSAwIDAgMCAwLTFIOWExIDEgMCAwIDAtMS0xdi0uNWEuNS41IDAgMCAwLTEgMFYzSDZ2LS41YS41LjUgMCAwIDAtMSAwem0wIDFoM3YzSDV6bTYuNSA3YS41LjUgMCAwIDAtLjUuNXYxYS41LjUgMCAwIDAgLjUuNWgyYS41LjUgMCAwIDAgLjUtLjV2LTFhLjUuNSAwIDAgMC0uNS0uNXoiIC8+CgkJPHBhdGggZD0iTTEgMmEyIDIgMCAwIDEgMi0yaDExYTIgMiAwIDAgMSAyIDJ2MTFhMiAyIDAgMCAxLTIgMkgzYTIgMiAwIDAgMS0yLTJ2LTJILjVhLjUuNSAwIDAgMS0uNS0uNXYtMUEuNS41IDAgMCAxIC41IDlIMVY4SC41YS41LjUgMCAwIDEtLjUtLjV2LTFBLjUuNSAwIDAgMSAuNSA2SDFWNUguNWEuNS41IDAgMCAxLS41LS41di0yQS41LjUgMCAwIDEgLjUgMnptMSAxMWExIDEgMCAwIDAgMSAxaDExYTEgMSAwIDAgMCAxLTFWMmExIDEgMCAwIDAtMS0xSDNhMSAxIDAgMCAwLTEgMXoiIC8+Cgk8L2c+Cjwvc3ZnPgo=',
	other: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMjQgMjQiPgoJPHBhdGggZD0iTTAgMGgyNHYyNEgweiIgZmlsbD0ibm9uZSIgLz4KCTxwYXRoIGZpbGw9ImN1cnJlbnRDb2xvciIgZD0iTTQgMjBxLS44MjUgMC0xLjQxMi0uNTg3VDIgMThWNnEwLS44MjUuNTg4LTEuNDEyVDQgNGgxN3EuNDI1IDAgLjcxMy4yODhUMjIgNXQtLjI4OC43MTNUMjEgNkg0djEyaDFxLjQyNSAwIC43MTMuMjg4VDYgMTl0LS4yODguNzEzVDUgMjB6bTE2LTJ2LThoLTR2OHptLTQuNSAycS0uNjI1IDAtMS4wNjItLjQzN1QxNCAxOC41di05cTAtLjYyNS40MzgtMS4wNjJUMTUuNSA4aDVxLjYyNSAwIDEuMDYzLjQzOFQyMiA5LjV2OXEwIC42MjUtLjQzNyAxLjA2M1QyMC41IDIwem0yLjUtNy41cS4zMjUgMCAuNTM4LS4yMjV0LjIxMi0uNTI1cTAtLjMyNS0uMjEzLS41MzdUMTggMTFxLS4zIDAtLjUyNS4yMTN0LS4yMjUuNTM3cTAgLjMuMjI1LjUyNVQxOCAxMi41bS05LjcgNi43NzVMOCAxOC4yNXEtLjQ3NS0uNDI1LS43MzctMVQ3IDE2dC4yNjMtMS4yNXQuNzM3LTFsLjMtMS4wMjVxLjEtLjMyNS4zNS0uNTI1dC42LS4yaDEuNXEuMzUgMCAuNi4ydC4zNS41MjVsLjMgMS4wMjVxLjQ3NS40MjUuNzM4IDFUMTMgMTZ0LS4yNjIgMS4yNXQtLjczOCAxbC0uMyAxLjAyNXEtLjEuMzI1LS4zNS41MjV0LS42LjJoLTEuNXEtLjM1IDAtLjYtLjJ0LS4zNS0uNTI1TTEwIDE3LjVxLjY1IDAgMS4wNzUtLjQzN1QxMS41IDE2dC0uNDUtMS4wNjJUMTAgMTQuNXQtMS4wNS40MjVUOC41IDE2dC40MjUgMS4wNzVUMTAgMTcuNW04LTMuNSIgLz4KPC9zdmc+Cg=='
};

function apiError(res, fallback) {
	if (!res || res.success === false)
		throw new Error((res && res.message) || fallback || '操作失败');
	return res;
}

function fmtTime(ts) {
	var n = parseInt(ts || '0', 10);
	if (!n)
		return '从未';
	var diff = Math.max(0, Math.floor(Date.now() / 1000) - n);
	if (diff < 60)
		return diff + ' 秒前';
	if (diff < 3600)
		return Math.floor(diff / 60) + ' 分钟前';
	if (diff < 86400)
		return Math.floor(diff / 3600) + ' 小时前';
	return new Date(n * 1000).toLocaleString();
}

function elapsed(ts) {
	var n = parseInt(ts || '0', 10);
	if (!n)
		return '00:00';
	var diff = Math.max(0, Math.floor(Date.now() / 1000) - n);
	var m = Math.floor(diff / 60);
	var s = diff % 60;
	return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

function normalizeStatus(s) {
	return statusMeta[s] ? s : 'unchecked';
}

function enabled(d) {
	return d.enabled !== '0';
}

function filteredDevices() {
	var q = (state.query || '').toLowerCase();
	return state.devices.filter(function(d) {
		var st = normalizeStatus(d.status);
		var text = [ d.name, d.ip, d.mac ].join(' ').toLowerCase();
		return (!state.status || state.status === st) &&
			(!q || text.indexOf(q) >= 0);
	});
}

function sortDevices(devices) {
	return (devices || []).slice().sort(function(a, b) {
		var ao = parseInt(a.order || '999999', 10);
		var bo = parseInt(b.order || '999999', 10);
		if (ao !== bo)
			return ao - bo;
		return String(a.name || '').localeCompare(String(b.name || ''));
	});
}

function saveDeviceOrder(root) {
	state.devices.forEach(function(d, i) {
		d.order = String(i + 1);
	});
	return callUpdateOrder({ ids: state.devices.map(function(d) { return d.id; }) }).then(function(res) {
		apiError(res);
		return reload(root);
	}).catch(function(err) {
		ui.addNotification(null, E('p', err.message || '保存排序失败'), 'danger');
		return reload(root);
	});
}

function reorderVisibleDevices(dragId, targetId, after, root) {
	if (!dragId || !targetId || dragId === targetId)
		return;

	var visible = filteredDevices().map(function(d) { return d.id; });
	var from = visible.indexOf(dragId);
	var to = visible.indexOf(targetId);
	if (from < 0 || to < 0)
		return;

	visible.splice(from, 1);
	if (from < to)
		to--;
	visible.splice(to + (after ? 1 : 0), 0, dragId);

	var order = {};
	var next = 0;
	visible.forEach(function(id) { order[id] = next++; });
	state.devices.forEach(function(d) {
		if (order[d.id] == null)
			order[d.id] = next++;
	});
	state.devices.sort(function(a, b) { return order[a.id] - order[b.id]; });
	renderBody(root);
	saveDeviceOrder(root);
}

function clearDropTargets(root) {
	if (!root)
		return;
	root.querySelectorAll('.lw-card.is-drop-target').forEach(function(el) {
		el.classList.remove('is-drop-target');
	});
}

function counts() {
	var c = { total: state.devices.length, online: 0, offline: 0, waking: 0, unknown: 0, enabled: 0 };
	state.devices.forEach(function(d) {
		var st = normalizeStatus(d.status);
		if (st === 'online') c.online++;
		if (st === 'offline') c.offline++;
		if (st === 'waking') c.waking++;
		if (st === 'unknown' || st === 'unchecked') c.unknown++;
		if (enabled(d)) c.enabled++;
	});
	return c;
}

function field(name, label, value, type, placeholder) {
	return E('label', { 'class': 'lw-field' }, [
		E('span', {}, label),
		E('input', {
			name: name,
			type: type || 'text',
			value: value || '',
			placeholder: placeholder || ''
		})
	]);
}

function selectField(name, label, value, options) {
	return E('label', { 'class': 'lw-field' }, [
		E('span', {}, label),
		E('select', { name: name }, options.map(function(o) {
			var attrs = { value: o[0] };
			if (String(value || '') === String(o[0]))
				attrs.selected = 'selected';
			return E('option', attrs, o[1]);
		}))
	]);
}

function iconPreviewField(value) {
	return E('div', { 'class': 'lw-field lw-icon-preview-field' }, [
		E('span', {}, '设备图标'),
		E('div', { 'class': 'lw-icon-preview' }, [
			E('span', { 'class': 'lw-icon-preview-symbol' }, renderIcon(value || 'pc'))
		])
	]);
}

function renderIcon(value) {
	var icon = iconMap[value] || iconMap.other;
	if (String(icon).indexOf('data:image/svg+xml') === 0)
		return E('span', {
			'class': 'lw-svg-icon',
			'style': '--lw-icon-url:url("' + icon + '")'
		});
	return icon;
}

function toggleField(name, label, value) {
	return E('label', { 'class': 'lw-toggle' }, [
		E('span', {}, label),
		E('input', { name: name, type: 'checkbox', checked: value === '1' || value === true })
	]);
}

function textareaField(name, label, value, placeholder) {
	return E('label', { 'class': 'lw-field lw-wide' }, [
		E('span', {}, label),
		E('textarea', { name: name, placeholder: placeholder || '' }, value || '')
	]);
}

function fillScannedDevice(body, item) {
	var name = body.querySelector('[name="name"]');
	var mac = body.querySelector('[name="mac"]');
	var ip = body.querySelector('[name="ip"]');
	var broadcast = body.querySelector('[name="broadcast"]');
	var title = item.hostname && item.hostname !== '-' ? item.hostname : item.ip;

	if (name && title)
		name.value = title;
	if (mac && item.mac && item.mac !== '-')
		mac.value = String(item.mac).toUpperCase();
	if (ip && item.ip)
		ip.value = item.ip;
	if (broadcast && item.ip) {
		var b = broadcastFromIp(item.ip);
		if (b) {
			broadcast.value = b;
			broadcast.setAttribute('data-auto-broadcast', '1');
		}
	}
}

function renderScanResults(body, wrap, items) {
	if (!items || !items.length) {
		wrap.innerHTML = '';
		wrap.appendChild(E('div', { 'class': 'lw-scan-empty' }, '未发现在线设备'));
		return;
	}

	wrap.innerHTML = '';
	wrap.appendChild(E('div', { 'class': 'lw-scan-table' }, [
		E('div', { 'class': 'lw-scan-row lw-scan-head' }, [
			E('div', {}, 'IP 地址'),
			E('div', {}, 'MAC 地址'),
			E('div', {}, 'MAC 厂商'),
			E('div', {}, '主机名'),
			E('div', {}, '操作')
		])
	].concat(items.map(function(item) {
		return E('div', { 'class': 'lw-scan-row' }, [
			E('div', {}, item.ip || '-'),
			E('div', {}, item.mac || '-'),
			E('div', {}, item.vendor || '-'),
			E('div', {}, item.hostname || '-'),
			E('div', {}, E('button', {
				'class': 'btn',
				click: function(ev) {
					ev.preventDefault();
					fillScannedDevice(body, item);
				}
			}, '填入'))
		]);
	}))));
}

function scanDevices(body, btn, wrap) {
	var old = btn.textContent;
	var pollCount = 0;
	btn.disabled = true;
	btn.classList.add('is-loading');
	btn.textContent = '扫描中';
	wrap.innerHTML = '';
	wrap.appendChild(E('div', { 'class': 'lw-scan-empty' }, '正在扫描在线设备...'));

	function finish() {
		btn.disabled = false;
		btn.classList.remove('is-loading');
		btn.textContent = old;
	}

	function legacyScan() {
		return callScanDevices().then(function(res) {
			apiError(res);
			renderScanResults(body, wrap, (res.data && res.data.devices) || []);
		});
	}

	function poll(jobId) {
		return callGetScan({ job_id: jobId }).then(function(res) {
			apiError(res);
			pollCount++;
			if (res.data && res.data.status === 'done') {
				renderScanResults(body, wrap, res.data.devices || []);
				return;
			}
			if (res.data && res.data.status === 'error')
				throw new Error(res.message || '扫描失败');
			if (pollCount > 90)
				throw new Error('扫描超时，请稍后重试');
			wrap.innerHTML = '';
			wrap.appendChild(E('div', { 'class': 'lw-scan-empty' }, '正在扫描在线设备...' + (res.data && res.data.scanned ? ' 已发现 ' + res.data.scanned + ' 台' : '')));
			return new Promise(function(resolve) {
				window.setTimeout(resolve, 800);
			}).then(function() {
				return poll(jobId);
			});
		});
	}

	return callStartScan().then(function(res) {
		apiError(res);
		if (!res.data || !res.data.job_id)
			return legacyScan();
		return poll(res.data.job_id);
	}).catch(function(err) {
		wrap.innerHTML = '';
		wrap.appendChild(E('div', { 'class': 'lw-scan-empty lw-scan-error' }, err.message || '扫描失败'));
	}).finally(function() {
		finish();
	});
}

function scanPanel(body) {
	var results = E('div', { 'class': 'lw-scan-results' });
	var btn = E('button', {
		'class': 'btn cbi-button-positive',
		click: function(ev) {
			ev.preventDefault();
			scanDevices(body, ev.currentTarget, results);
		}
	}, '扫描在线设备');

	return E('div', { 'class': 'lw-scan-panel lw-wide' }, [
		E('div', { 'class': 'lw-scan-title' }, [
			E('span', {}, '设备扫描'),
			btn
		]),
		results
	]);
}

function getFormData(node) {
	var data = {};
	Array.prototype.forEach.call(node.querySelectorAll('[name]'), function(el) {
		if (el.type === 'checkbox')
			data[el.name] = el.checked ? '1' : '0';
		else
			data[el.name] = el.value.trim();
	});
	if (!data.broadcast && data.ip) {
		var p = data.ip.split('.');
		if (p.length === 4)
			data.broadcast = p[0] + '.' + p[1] + '.' + p[2] + '.255';
	}
	return data;
}

function broadcastFromIp(ip) {
	var p = (ip || '').split('.');
	if (p.length !== 4)
		return '';
	for (var i = 0; i < 4; i++) {
		if (!/^\d{1,3}$/.test(p[i]) || +p[i] < 0 || +p[i] > 255)
			return '';
	}
	return p[0] + '.' + p[1] + '.' + p[2] + '.255';
}

function validateDevice(data) {
	if (!data.name)
		return '请输入设备名称';
	if (!/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(data.mac))
		return 'MAC 地址格式错误';
	if (data.ip && !/^((25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(25[0-5]|2[0-4]\d|1?\d?\d)$/.test(data.ip))
		return 'IP 地址格式错误';
	var port = parseInt(data.port || '9', 10);
	if (!port || port < 1 || port > 65535)
		return 'WOL 端口必须为 1 到 65535';
	return null;
}

function reload(root) {
	return Promise.all([ callList(), callDeps(), callSettings() ]).then(function(res) {
		state.devices = sortDevices((res[0].data && res[0].data.devices) || []);
		state.deps = res[1].data || {};
		state.settings = res[2].data || {};
		if (root) {
			renderBody(root);
			startTimers(root);
		}
	});
}

function loadData() {
	return Promise.all([ callList(), callDeps(), callSettings() ]).then(function(res) {
		return { ok: true, data: res };
	}).catch(function(err) {
		return { ok: false, error: err };
	});
}

function applyLoadedData(data) {
	var res = data && data.ok === true ? data.data : data;
	state.devices = sortDevices((res[0].data && res[0].data.devices) || []);
	state.deps = res[1].data || {};
	state.settings = res[2].data || {};
	state.backendRetryCount = 0;
}

function parseCssColor(value) {
	var m, p, n;

	if (!value || value === 'transparent')
		return null;

	m = String(value).match(/^rgba?\(([^)]+)\)$/i);
	if (m) {
		p = m[1].split(',').map(function(v) { return v.trim(); });
		if (p.length < 3)
			return null;
		if (p.length > 3 && parseFloat(p[3]) === 0)
			return null;
		return {
			r: Math.max(0, Math.min(255, parseFloat(p[0]) || 0)),
			g: Math.max(0, Math.min(255, parseFloat(p[1]) || 0)),
			b: Math.max(0, Math.min(255, parseFloat(p[2]) || 0))
		};
	}

	m = String(value).match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (!m)
		return null;

	n = m[1];
	if (n.length === 3)
		n = n.charAt(0) + n.charAt(0) + n.charAt(1) + n.charAt(1) + n.charAt(2) + n.charAt(2);

	return {
		r: parseInt(n.substr(0, 2), 16),
		g: parseInt(n.substr(2, 2), 16),
		b: parseInt(n.substr(4, 2), 16)
	};
}

function backgroundColorOf(node) {
	var el = node, c;

	while (el && el.nodeType === 1) {
		c = parseCssColor(window.getComputedStyle(el).backgroundColor);
		if (c)
			return c;
		el = el.parentElement;
	}

	return null;
}

function actualPageBackground(node) {
	var probes = [], el = node && node.parentElement;
	var i, c;

	while (el) {
		probes.push(el);
		el = el.parentElement;
	}

	[ '#maincontent', '#content', '.main', '.main-content', 'body', 'html' ].forEach(function(selector) {
		var found = document.querySelector(selector);
		if (found)
			probes.push(found);
	});

	for (i = 0; i < probes.length; i++) {
		c = backgroundColorOf(probes[i]);
		if (c)
			return c;
	}

	return { r: 255, g: 255, b: 255 };
}

function isDarkBackground(c) {
	return ((c.r * 299 + c.g * 587 + c.b * 114) / 1000) < 128;
}

function applyRuntimeTheme(content) {
	var dark;

	if (!content || !content.classList)
		return;

	dark = isDarkBackground(actualPageBackground(content));
	content.classList.toggle('lan-wake-dark', dark);
	document.documentElement.classList.toggle('lan-wake-dark-page', dark);
	if (document.body)
		document.body.classList.toggle('lan-wake-dark-page', dark);
}

function syncRuntimeTheme(content) {
	applyRuntimeTheme(content);
	window.setTimeout(function() { applyRuntimeTheme(content); }, 0);
	window.setTimeout(function() { applyRuntimeTheme(content); }, 250);
}

function setMainBlur(root, enabled) {
	var node = root && root.querySelector ? root.querySelector('.lan-wake') : null;
	if (!node)
		return;
	node.classList.toggle('is-modal-blurred', !!enabled);
}

function closeModal(root) {
	ui.hideModal();
	setMainBlur(root, false);
	if (state.modalBlurTimer) {
		window.clearInterval(state.modalBlurTimer);
		state.modalBlurTimer = null;
	}
}

function showBlurModal(root, title, content, cls) {
	setMainBlur(root, true);
	ui.showModal(title, content, cls);

	if (state.modalBlurTimer)
		window.clearInterval(state.modalBlurTimer);

	state.modalBlurTimer = window.setInterval(function() {
		if (!document.querySelector('.lw-modal')) {
			setMainBlur(root, false);
			window.clearInterval(state.modalBlurTimer);
			state.modalBlurTimer = null;
		}
	}, 250);
}

function renderBackendLoading(root, err) {
	if (state.backendRetry)
		window.clearTimeout(state.backendRetry);

	var message = err && err.message ? err.message : 'rpcd 后端对象暂未加载';
	var content = E('div', { 'class': 'lan-wake' }, [
		E('style', {}, css()),
		E('div', { 'class': 'lw-head' }, [
			E('div', {}, [
				E('h2', {}, '局域网设备唤醒')
			]),
			''
		]),
		E('div', { 'class': 'lw-backend-wait' }, [
			E('h3', {}, '后端正在加载'),
			E('p', {}, '已安装菜单，但 rpcd 还没有注册 lan-wake 对象，页面会自动重试。'),
			E('p', { 'class': 'lw-backend-detail' }, message),
			E('button', {
				'class': 'btn cbi-button-positive',
				click: function() {
					state.backendRetryCount = 0;
					retryBackend(root);
				}
			}, '立即重试')
		])
	]);

	root.innerHTML = '';
	root.appendChild(content);
	syncRuntimeTheme(content);

	if (state.backendRetryCount < 20) {
		state.backendRetry = window.setTimeout(function() {
			retryBackend(root);
		}, 1500);
	}
}

function retryBackend(root) {
	state.backendRetryCount++;
	loadData().then(function(data) {
		if (data.ok) {
			applyLoadedData(data);
			renderBody(root);
			startTimers(root);
		}
		else {
			renderBackendLoading(root, data.error);
		}
	});
}

function updateInlineTimers(root) {
	if (!root)
		return;
	root.querySelectorAll('.lw-inline-timer[data-pending-since]').forEach(function(el) {
		el.textContent = elapsed(el.getAttribute('data-pending-since'));
	});
	root.querySelectorAll('.lw-relative-time[data-ts]').forEach(function(el) {
		el.textContent = fmtTime(el.getAttribute('data-ts'));
	});
}

function startTimers(root) {
	if (state.timer)
		window.clearInterval(state.timer);
	if (state.wakeTimer)
		window.clearInterval(state.wakeTimer);
	if (state.uiTimer)
		window.clearInterval(state.uiTimer);
	state.timer = null;
	state.wakeTimer = null;
	state.uiTimer = null;

	if (!root)
		return;

	if (state.devices.length) {
		state.uiTimer = window.setInterval(function() {
			updateInlineTimers(root);
		}, 1000);
	}

	var hasWaking = state.devices.some(function(d) { return normalizeStatus(d.status) === 'waking'; });
	if (hasWaking) {
		var wakeInterval = parseInt(state.settings.wake_check_interval || '5', 10);
		if (!wakeInterval || wakeInterval < 1)
			wakeInterval = 1;
		state.wakeTimer = window.setInterval(function() {
			refreshStatus(root, null, false);
		}, wakeInterval * 1000);
	}

	if (state.settings.auto_check !== '0') {
		var interval = parseInt(state.settings.check_interval || '300', 10);
		if (!interval || interval < 5)
			interval = 300;
		state.timer = window.setInterval(function() {
			refreshStatus(root, root.querySelector('[data-action="refresh-status"]'));
		}, interval * 1000);
	}
}

function action(btn, promise, root, okMsg) {
	var old = btn.textContent;
	btn.disabled = true;
	btn.classList.add('is-loading');
	btn.textContent = '处理中';
	return promise.then(function(res) {
		apiError(res);
		return reload(root);
	}).catch(function(err) {
		ui.addNotification(null, E('p', err.message || '操作失败'), 'danger');
	}).finally(function() {
		btn.disabled = false;
		btn.classList.remove('is-loading');
		btn.textContent = old;
	});
}

function silentAction(btn, promise, root) {
	var old = btn.textContent;
	btn.disabled = true;
	btn.classList.add('is-loading');
	btn.textContent = '处理中';
	return promise.then(function(res) {
		apiError(res);
		return reload(root);
	}).catch(function(err) {
		ui.addNotification(null, E('p', err.message || '操作失败'), 'danger');
	}).finally(function() {
		btn.disabled = false;
		btn.classList.remove('is-loading');
		btn.textContent = old;
	});
}

function refreshStatus(root, btn) {
	if (state.refreshing)
		return Promise.resolve();

	var old = btn ? btn.textContent : null;
	state.refreshing = true;
	if (btn) {
		btn.disabled = true;
		btn.classList.add('is-loading');
		btn.textContent = '刷新中';
	}

	return callCheckAll().then(function(res) {
		apiError(res);
		state.refreshing = false;
		return reload(root);
	}).catch(function(err) {
		ui.addNotification(null, E('p', err.message || '刷新失败'), 'danger');
	}).finally(function() {
		state.refreshing = false;
		if (btn) {
			btn.disabled = false;
			btn.classList.remove('is-loading');
			btn.textContent = old || '刷新状态';
		}
	});
}

function statCard(label, value, cls, icon) {
	return E('div', { 'class': 'lw-stat ' + cls }, [
		E('div', { 'class': 'lw-stat-icon' }, typeof icon === 'string' ? E('span', { 'class': 'lw-stat-symbol' }, icon) : icon),
		E('div', {}, [
			E('div', { 'class': 'lw-stat-label' }, label),
			E('div', { 'class': 'lw-stat-value' }, [ String(value), E('small', {}, ' 台') ])
		])
	]);
}

function totalDevicesIcon() {
	return E('span', { 'class': 'lw-network-icon', 'aria-hidden': 'true' });
}

function wakingDevicesIcon() {
	return E('span', { 'class': 'lw-wake-stat-icon', 'aria-hidden': 'true' });
}

function cardActions(d, root) {
	var st = normalizeStatus(d.status);
	var buttons = [];
	var wakeBtnClass = 'btn';
	if (st === 'waking')
		wakeBtnClass += ' lw-wake-btn-waking';
	else if (st !== 'online')
		wakeBtnClass += ' lw-wake-btn';
	buttons.push(E('button', { 'class': wakeBtnClass, click: function(ev) {
		action(ev.currentTarget, callWake({ id: d.id }), root, '唤醒指令已发送');
	}}, '唤醒'));
	if (st === 'unknown')
		buttons.push(E('button', { 'class': 'btn', click: function(ev) {
			action(ev.currentTarget, callCheck({ id: d.id }), root, '检测完成');
		}}, '重新检测'));
	buttons.push(E('button', { 'class': 'btn', click: function() { showDeviceModal(d, root); } }, '编辑'));
	buttons.push(E('button', { 'class': 'btn', click: function(ev) {
		if (confirm('确认删除设备 "' + d.name + '"？此操作不可恢复。'))
			action(ev.currentTarget, callDelete({ id: d.id }), root, '设备已删除');
	}}, '删除'));
	return buttons;
}

function deviceCard(d, root) {
	var st = normalizeStatus(d.status);
	var meta = statusMeta[st];
	return E('div', {
		'class': 'lw-card st-' + meta.cls + (enabled(d) ? '' : ' is-disabled'),
		'draggable': 'true',
		'data-device-id': d.id,
		dragstart: function(ev) {
			state.draggingId = d.id;
			ev.currentTarget.classList.add('is-dragging');
			if (ev.dataTransfer) {
				ev.dataTransfer.effectAllowed = 'move';
				ev.dataTransfer.setData('text/plain', d.id);
			}
		},
		dragend: function(ev) {
			ev.currentTarget.classList.remove('is-dragging');
			state.draggingId = null;
			clearDropTargets(root);
		},
		dragover: function(ev) {
			if (!state.draggingId || state.draggingId === d.id)
				return;
			ev.preventDefault();
			clearDropTargets(root);
			ev.currentTarget.classList.add('is-drop-target');
			if (ev.dataTransfer)
				ev.dataTransfer.dropEffect = 'move';
		},
		drop: function(ev) {
			if (!state.draggingId || state.draggingId === d.id)
				return;
			ev.preventDefault();
			var rect = ev.currentTarget.getBoundingClientRect();
			var after = ev.clientY > rect.top + rect.height / 2 || ev.clientX > rect.left + rect.width / 2;
			var dragId = state.draggingId;
			state.draggingId = null;
			clearDropTargets(root);
			reorderVisibleDevices(dragId, d.id, after, root);
		}
	}, [
		E('div', { 'class': 'lw-card-head' }, [
			E('span', { 'class': 'lw-status-dot ' + meta.cls }),
			E('span', { 'class': 'lw-status-text' }, [
				meta.text,
				st === 'waking' ? E('span', { 'class': 'lw-inline-timer', 'data-pending-since': d.pending_since || '' }, elapsed(d.pending_since)) : ''
			]),
			E('span', { 'class': 'lw-device-icon ' + meta.cls }, renderIcon(d.icon))
		]),
		E('div', { 'class': 'lw-name' }, d.name || '未命名设备'),
		E('div', { 'class': 'lw-addr' }, [
			E('div', {}, d.ip || '-'),
			E('div', {}, d.mac || '-')
		]),
		E('div', { 'class': 'lw-meta' }, [
			E('span', {}, '最近在线'),
			E('b', { 'class': 'lw-relative-time', 'data-ts': d.last_seen_at || '0' }, fmtTime(d.last_seen_at)),
			E('span', {}, '最后检测'),
			E('b', { 'class': 'lw-relative-time', 'data-ts': d.last_checked_at || '0' }, fmtTime(d.last_checked_at))
		]),
		E('div', { 'class': 'lw-actions' }, cardActions(d, root))
	]);
}

function listView(devices, root) {
	var heads = [
		[ '状态', 'status' ],
		[ '设备', 'device' ],
		[ 'IP', 'ip' ],
		[ 'MAC', 'mac' ],
		[ '最近在线', 'seen' ],
		[ '操作', 'actions' ]
	];
	var rows = [
		E('div', { 'class': 'lw-row lw-row-head' }, heads.map(function(h) {
			return E('div', { 'class': 'lw-list-head lw-list-' + h[1] }, h[0]);
		}))
	];

	devices.forEach(function(d) {
		var st = normalizeStatus(d.status), meta = statusMeta[st];
		rows.push(E('div', { 'class': 'lw-row' }, [
			E('div', { 'class': 'lw-list-status' }, [ E('span', { 'class': 'lw-status-dot ' + meta.cls }), meta.text ]),
			E('div', { 'class': 'lw-list-device' }, d.name),
			E('div', { 'class': 'lw-list-ip' }, d.ip || '-'),
			E('div', { 'class': 'lw-list-mac' }, d.mac || '-'),
			E('div', { 'class': 'lw-list-seen lw-relative-time', 'data-ts': d.last_seen_at || '0' }, fmtTime(d.last_seen_at)),
			E('div', { 'class': 'lw-list-actions lw-actions' }, cardActions(d, root))
		]));
	});

	return E('div', { 'class': 'lw-table' }, rows);
}

function dependencyBanner() {
	if (state.deps.wol)
		return '';
	return E('div', { 'class': 'lw-alert' }, '未检测到 etherwake 或 wakeonlan，唤醒功能不可用。请安装依赖后刷新页面。');
}

function filterBar(root) {
	var currentStatus = statusMeta[state.status] ? state.status : '';
	var refreshAttrs = {
		'class': 'btn cbi-button-positive',
		'data-action': 'refresh-status',
		click: function(ev) { refreshStatus(root, ev.currentTarget); }
	};
	if (state.refreshing)
		refreshAttrs.disabled = 'disabled';
	var statusSelect = E('select', { change: function(ev) {
		state.status = ev.target.value || '';
		renderBody(root);
	} }, [
		E('option', { value: '' }, '全部设备'),
		E('option', { value: 'online' }, '在线'),
		E('option', { value: 'offline' }, '离线'),
		E('option', { value: 'unknown' }, '未知'),
		E('option', { value: 'waking' }, '唤醒中'),
		E('option', { value: 'unchecked' }, '未检测')
	]);
	statusSelect.value = currentStatus;

	return E('div', { 'class': 'lw-filters' }, [
		E('button', { 'class': 'lw-view-btn ' + (state.view === 'card' ? 'active' : ''), title: '卡片视图', 'aria-label': '卡片视图', click: function() { state.view = 'card'; renderBody(root); } }, E('span', { 'class': 'lw-grid-icon' })),
		E('button', { 'class': 'lw-view-btn ' + (state.view === 'list' ? 'active' : ''), title: '列表视图', 'aria-label': '列表视图', click: function() { state.view = 'list'; renderBody(root); } }, '☰'),
		statusSelect,
		E('input', {
			placeholder: '搜索设备名称、IP 或 MAC 地址',
			value: state.queryDraft || state.query,
			input: function(ev) {
				state.queryDraft = ev.target.value;
				if (state.searchTimer)
					window.clearTimeout(state.searchTimer);
				state.searchTimer = window.setTimeout(function() {
					if (state.query === state.queryDraft)
						return;
					state.query = state.queryDraft;
					renderBody(root);
				}, 1000);
			}
		}),
		E('div', { 'class': 'lw-toolbar-actions' }, [
			E('button', { 'class': 'btn cbi-button-positive', click: function() { showDeviceModal(null, root); } }, '添加设备'),
			E('button', refreshAttrs, state.refreshing ? '刷新中' : '刷新状态'),
			E('button', { 'class': 'btn cbi-button-positive', click: function() { showSettingsModal(root); } }, '设置')
		])
	]);
}

function formTabs(enabledValue, bootAutoCheck, wakeAutoCheck, broadcastWol) {
	return E('div', { 'class': 'lw-tabs-bar' }, [
		E('div', { 'class': 'lw-tabs' }, [
			E('button', { 'class': 'active', 'data-tab': 'base' }, '基本信息'),
			E('button', { 'data-tab': 'advanced' }, '高级设置')
		]),
		E('div', { 'class': 'lw-device-toggles' }, [
			E('label', { 'class': 'lw-enable-inline' }, [
				E('span', {}, '启用设备'),
				E('input', { name: 'enabled', type: 'checkbox', checked: enabledValue === '1' || enabledValue === true })
			]),
			E('label', { 'class': 'lw-enable-inline' }, [
				E('span', {}, '开机后自动检测'),
				E('input', { name: 'boot_auto_check', type: 'checkbox', checked: bootAutoCheck !== '0' })
			]),
			E('label', { 'class': 'lw-enable-inline' }, [
				E('span', {}, '唤醒后自动检测'),
				E('input', { name: 'wake_auto_check', type: 'checkbox', checked: wakeAutoCheck !== '0' })
			]),
			E('label', { 'class': 'lw-enable-inline' }, [
				E('span', {}, '发送到广播地址'),
				E('input', { name: 'broadcast_wol', type: 'checkbox', checked: broadcastWol === '1' || broadcastWol === true })
			])
		])
	]);
}

function submitDeviceForm(body, d, root, btn) {
	var payload = getFormData(body);
	if (d.id)
		payload.id = d.id;
	var err = validateDevice(payload);
	if (err) {
		ui.addNotification(null, E('p', err), 'danger');
		return;
	}
	return action(btn, d.id ? callUpdate(payload) : callAdd(payload), root, d.id ? '设备已更新' : '设备已添加').then(function() {
		closeModal(root);
	});
}

function showDeviceModal(device, root) {
	var d = device || {};
	var iconValue = d.icon || 'pc';
	var body = E('div', { 'class': 'lw-modal-form' }, [
		formTabs(d.enabled !== '0', d.boot_auto_check, d.wake_auto_check, d.broadcast_wol),
		E('div', { 'class': 'lw-tab-panel active', 'data-panel': 'base' }, [
			E('div', { 'class': 'lw-scan-slot lw-wide' }),
			field('name', '设备名称 *', d.name, 'text', '例如：NAS 服务器'),
			field('mac', 'MAC 地址 *', d.mac, 'text', '例如：00:11:32:AA:BB:CC'),
			field('ip', 'IP 地址', d.ip, 'text', '例如：192.168.1.100'),
			field('broadcast', '广播地址', d.broadcast || state.settings.default_broadcast, 'text', '例如：192.168.1.255'),
			selectField('icon', '设备类型', iconValue, [
				[ 'nas', 'NAS' ], [ 'router', '路由器' ], [ 'server', '服务器' ], [ 'vm', '虚拟机' ],
				[ 'laptop', '笔记本' ], [ 'pc', '台式电脑' ], [ 'mini', '迷你主机' ], [ 'game', '游戏主机' ],
				[ 'television', '电视设备' ], [ 'smart_home', '智能家居' ], [ 'devboard', '开发板' ], [ 'other', '其他' ]
			]),
			iconPreviewField(iconValue),
			textareaField('note', '备注', d.note, '可选，添加设备备注信息')
		]),
		E('div', { 'class': 'lw-tab-panel', 'data-panel': 'advanced' }, [
			field('port', 'WOL 端口', d.port || state.settings.default_port || '9', 'number'),
			field('check_interval', '检测间隔（秒）', d.check_interval || state.settings.check_interval || '300', 'number'),
			field('unknown_time', '未知状态时间（秒）', d.unknown_time || state.settings.unknown_time || '300', 'number'),
			field('offline_time', '离线判定时间（秒）', d.offline_time || state.settings.offline_time || '3600', 'number')
		])
	]);

	var scanSlot = body.querySelector('.lw-scan-slot');
	if (scanSlot)
		scanSlot.appendChild(scanPanel(body));

	var ipInput = body.querySelector('[name="ip"]');
	var broadcastInput = body.querySelector('[name="broadcast"]');
	var iconSelect = body.querySelector('[name="icon"]');
	var iconPreview = body.querySelector('.lw-icon-preview-symbol');
	if (iconSelect && iconPreview) {
		iconSelect.addEventListener('change', function() {
			iconPreview.innerHTML = '';
			iconPreview.appendChild(renderIcon(iconSelect.value));
		});
	}
	if (ipInput && broadcastInput) {
		broadcastInput.setAttribute('data-auto-broadcast', d.broadcast ? '0' : '1');
		ipInput.addEventListener('input', function() {
			var broadcast = broadcastFromIp(ipInput.value.trim());
			if (broadcast && (!broadcastInput.value || broadcastInput.getAttribute('data-auto-broadcast') === '1')) {
				broadcastInput.value = broadcast;
				broadcastInput.setAttribute('data-auto-broadcast', '1');
			}
		});
		broadcastInput.addEventListener('input', function() {
			broadcastInput.setAttribute('data-auto-broadcast', '0');
		});
	}

	body.addEventListener('click', function(ev) {
		if (!ev.target.matches('.lw-tabs button'))
			return;
		var tab = ev.target.getAttribute('data-tab');
		body.querySelectorAll('.lw-tabs button').forEach(function(b) { b.classList.toggle('active', b === ev.target); });
		body.querySelectorAll('.lw-tab-panel').forEach(function(p) { p.classList.toggle('active', p.getAttribute('data-panel') === tab); });
	});

	showBlurModal(root, d.id ? '编辑设备' : '添加设备', [
		body,
		E('div', { 'class': 'right lw-modal-actions' }, [
			E('button', { 'class': 'btn', click: function() { closeModal(root); } }, '取消'),
			E('button', { 'class': 'btn cbi-button-positive', click: function(ev) {
				submitDeviceForm(body, d, root, ev.currentTarget);
			}}, '保存')
		])
	], 'lw-modal');
}

function showSettingsModal(root) {
	var s = state.settings || {};
	var autoCheckToggle = E('label', { 'class': 'lw-settings-auto-check' }, [
		E('span', {}, '启用定时检测'),
		E('input', { name: 'auto_check', type: 'checkbox', checked: s.auto_check !== '0' })
	]);
	var body = E('div', { 'class': 'lw-modal-form' }, [
		autoCheckToggle,
		field('interface', '默认接口', s.interface || 'br-lan', 'text'),
		field('default_broadcast', '默认广播地址', s.default_broadcast || '192.168.1.255', 'text'),
		field('default_port', '默认 WOL 端口', s.default_port || '9', 'number'),
		field('check_interval', '检测间隔（秒）', s.check_interval || '300', 'number'),
		field('unknown_time', '未知状态时间（秒）', s.unknown_time || '300', 'number'),
		field('offline_time', '离线判定时间（秒）', s.offline_time || '3600', 'number'),
		field('wake_check_interval', '唤醒后检测间隔（秒）', s.wake_check_interval || '5', 'number'),
		field('wake_timeout', '唤醒等待超时（秒）', s.wake_timeout || '300', 'number')
	]);
	showBlurModal(root, '设置', [
		body,
		E('div', { 'class': 'right lw-modal-actions' }, [
			E('button', { 'class': 'btn', click: function() { closeModal(root); } }, '取消'),
			E('button', { 'class': 'btn cbi-button-positive', click: function(ev) {
				action(ev.currentTarget, callUpdateSettings(getFormData(body)), root, '设置已保存').then(function() {
					closeModal(root);
				});
			}}, '保存')
		])
	], 'lw-modal');
}

function renderBody(root) {
	var c = counts();
	var list = filteredDevices();
	var content = E('div', { 'class': 'lan-wake' }, [
		E('style', {}, css()),
		E('div', { 'class': 'lw-head' }, [
			E('div', {}, [
				E('h2', {}, '局域网设备唤醒')
			]),
			''
		]),
		dependencyBanner(),
		filterBar(root),
		E('div', { 'class': 'lw-stats' }, [
			statCard('设备总数', c.total, 'blue', totalDevicesIcon()),
			statCard('在线设备', c.online, 'green', '✓'),
			statCard('离线设备', c.offline, 'red', '✕'),
			statCard('正在唤醒', c.waking, 'orange', wakingDevicesIcon()),
			statCard('未知状态', c.unknown, 'gray', '?')
		]),
		list.length ? (state.view === 'list' ? listView(list, root) : E('div', { 'class': 'lw-grid', dragover: function(ev) { ev.preventDefault(); } }, list.map(function(d) { return deviceCard(d, root); }))) :
			E('div', { 'class': 'lw-empty' }, [
				E('h3', {}, '暂无设备'),
				E('p', {}, '添加第一台设备后即可开始远程唤醒和状态管理。'),
				E('button', { 'class': 'btn cbi-button-positive', click: function() { showDeviceModal(null, root); } }, '添加设备')
			]),
		E('div', { 'class': 'lw-about' }, [
			E('div', { 'class': 'lw-about-title' }, [
				E('span', { 'class': 'lw-info-icon' }, 'i'),
				'关于插件'
			]),
			E('div', { 'class': 'lw-about-body' }, [
				E('div', { 'class': 'lw-about-left' }, [
					E('div', {}, [
						E('span', { 'class': 'lw-about-label' }, '项目地址：'),
						E('a', { href: 'https://github.com/adminchenyu/LAN-Wake', target: '_blank', rel: 'noopener noreferrer' }, 'https://github.com/adminchenyu/LAN-Wake')
					]),
					E('div', {}, [
						E('span', { 'class': 'lw-about-label' }, '问题反馈：'),
						E('span', { 'class': 'lw-about-linklike' }, 'admin@chenyu.cc')
					])
				]),
				E('div', { 'class': 'lw-about-right' }, [
					'Copyright ',
					E('span', { 'class': 'lw-copy-mark' }, '©'),
					' 2026 chenyu. All Rights Reserved.'
				])
			])
		])
	]);
	root.innerHTML = '';
	root.appendChild(content);
	syncRuntimeTheme(content);
}

function css() {
	return '.lan-wake{--lw-blue:#155eef;--lw-green:#16a34a;--lw-red:#ef4444;--lw-orange:#f59e0b;--lw-gray:#667085;color:#111827;max-width:1280px;margin:0 auto}' +
	'.lw-head{display:block;margin-bottom:14px}.lw-head h2{box-sizing:border-box;width:100%;font-size:26px;margin:0;font-weight:700;background:#fff;border-radius:6px;padding:16px 22px;color:#1f1b4d;box-shadow:0 8px 18px rgba(15,23,42,.08)}.lw-head p{margin:0;color:#667085}.lw-actions{display:flex;gap:8px;flex-wrap:wrap}.btn{border:1px solid #d7deea;background:#fff;border-radius:8px;padding:8px 12px;color:#1f2a44;cursor:pointer;text-decoration:none;line-height:1.2}.btn:hover{border-color:#98a2b3}.btn[disabled],a[disabled]{opacity:.45;pointer-events:none}.cbi-button-positive{background:var(--lw-blue)!important;color:#fff!important;border-color:var(--lw-blue)!important}.lw-danger{color:#ef4444!important;border-color:#fecaca!important;background:#fff7f7!important}.is-loading{opacity:.8}.lw-alert{border:1px solid #fed7aa;background:#fff7ed;color:#9a3412;border-radius:8px;padding:12px 14px;margin-bottom:16px}.lw-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:18px}.lw-stat{border:1px solid #d9e0ea;border-radius:6px;background:#fff;padding:16px;display:flex;gap:16px;align-items:center;min-height:60px;box-shadow:0 1px 3px rgba(15,23,42,.04)}.lw-stat-icon{width:42px;height:42px;border-radius:10px;background:#4f46e5;display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 10px 18px rgba(79,70,229,.16)}.lw-stat-symbol{font-size:22px;font-weight:700;line-height:1}.lw-network-icon{width:24px;height:24px;display:block;background:currentColor;-webkit-mask:url(\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjYiIGhlaWdodD0iNiIgcng9IjEiLz48cmVjdCB4PSIyIiB5PSIxNiIgd2lkdGg9IjYiIGhlaWdodD0iNiIgcng9IjEiLz48cmVjdCB4PSI5IiB5PSIyIiB3aWR0aD0iNiIgaGVpZ2h0PSI2IiByeD0iMSIvPjxwYXRoIGQ9Ik01IDE2di0zYTEgMSAwIDAgMSAxLTFoMTJhMSAxIDAgMCAxIDEgMXYzIi8+PHBhdGggZD0iTTEyIDEyVjgiLz48L3N2Zz4=\") center/24px 24px no-repeat;mask:url(\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjYiIGhlaWdodD0iNiIgcng9IjEiLz48cmVjdCB4PSIyIiB5PSIxNiIgd2lkdGg9IjYiIGhlaWdodD0iNiIgcng9IjEiLz48cmVjdCB4PSI5IiB5PSIyIiB3aWR0aD0iNiIgaGVpZ2h0PSI2IiByeD0iMSIvPjxwYXRoIGQ9Ik01IDE2di0zYTEgMSAwIDAgMSAxLTFoMTJhMSAxIDAgMCAxIDEgMXYzIi8+PHBhdGggZD0iTTEyIDEyVjgiLz48L3N2Zz4=\") center/24px 24px no-repeat}.lw-stat.green .lw-stat-icon{background:#059669}.lw-stat.red .lw-stat-icon{background:#ef4444}.lw-stat.gray .lw-stat-icon{background:#98a2b3}.lw-stat.orange .lw-stat-icon{background:#f59e0b}.lw-stat-label{color:#344054;margin-bottom:5px;font-size:13px;font-weight:500}.lw-stat-value{font-size:24px;font-weight:700;line-height:1;color:#1f1b4d}.lw-stat.green .lw-stat-value{color:#00805f}.lw-stat.red .lw-stat-value{color:#344054}.lw-stat.gray .lw-stat-value{color:#1f1b4d}.lw-stat-value small{font-size:14px;margin-left:6px;font-weight:600}.lw-filters{display:grid;grid-template-columns:44px 44px 180px 180px minmax(260px,520px) minmax(280px,1fr);gap:12px;align-items:center;margin-bottom:18px}.lw-toolbar-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}.lw-filters input,.lw-filters select,.lw-field input,.lw-field select,.lw-field textarea{width:100%;box-sizing:border-box;border:1px solid #d7deea;border-radius:8px;background:#fff;color:#111827;padding:10px 12px;min-height:40px}.lw-filters button.active{background:#155eef;color:#fff;border-color:#155eef}.lw-view-btn{min-height:40px;padding:0!important;font-size:20px;font-weight:800;display:flex;align-items:center;justify-content:center}.lw-grid-icon{width:17px;height:17px;display:grid;grid-template-columns:repeat(2,1fr);grid-template-rows:repeat(2,1fr);gap:3px}.lw-grid-icon:before{content:\"\";display:block;background:currentColor;border-radius:2px;box-shadow:10px 0 0 currentColor,0 10px 0 currentColor,10px 10px 0 currentColor}.lw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}.lw-card{position:relative;border:1px solid #e5eaf3;border-radius:10px;padding:16px;background:#fff;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease;overflow:hidden}.lw-card:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(15,23,42,.08)}.lw-card.st-online{background:linear-gradient(145deg,#fff,#f0fdf4)}.lw-card.st-offline{background:linear-gradient(145deg,#fff,#fff1f2)}.lw-card.st-waking{background:linear-gradient(145deg,#fff,#fffbeb)}.lw-card.st-shutting{background:linear-gradient(145deg,#fff,#fff7ed)}.lw-card.st-unknown,.lw-card.st-unchecked{background:linear-gradient(145deg,#fff,#f8fafc)}.lw-card.is-disabled{opacity:.65}.lw-card-head{display:flex;align-items:center;gap:8px}.lw-status-dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:#98a2b3}.lw-status-dot.online{background:#16a34a}.lw-status-dot.offline{background:#ef4444}.lw-status-dot.waking{background:#f59e0b;animation:lwPulse 1.2s infinite}.lw-status-dot.shutting{background:#f97316;animation:lwPulse 1.2s infinite}.lw-status-text{font-weight:700;font-size:13px;color:#344054}.lw-device-icon{margin-left:auto;width:42px;height:42px;border-radius:50%;background:rgba(102,112,133,.10);display:flex;align-items:center;justify-content:center;color:#667085;font-size:22px}.lw-name{font-size:20px;font-weight:800;margin:12px 0 8px;letter-spacing:0}.lw-tagline{display:flex;gap:8px;margin-bottom:12px}.lw-tagline span{background:#eef4ff;color:#155eef;border-radius:6px;padding:3px 8px;font-size:12px;font-weight:700}.lw-addr{line-height:1.8;color:#344054}.lw-meta{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:12px 0;color:#667085}.lw-meta b{color:#344054;font-weight:600}.lw-progress{font-weight:800;color:#b45309;margin-bottom:10px}.lw-table{border:1px solid #e5eaf3;border-radius:10px;overflow:auto;background:#fff}.lw-row{display:grid;grid-template-columns:110px 1.4fr 1fr 1.2fr 1fr 1fr 2fr;gap:12px;align-items:center;padding:12px 14px;border-top:1px solid #eef2f7;min-width:900px}.lw-row-head{border-top:0;background:#f8fafc;color:#667085;font-weight:700}.lw-empty{text-align:center;border:1px dashed #cbd5e1;border-radius:12px;padding:48px 16px;background:#f8fafc}.lw-about{border:1px solid #d9e0ea;border-radius:6px;background:#fff;margin-top:28px;padding:14px 18px;box-shadow:0 1px 3px rgba(15,23,42,.04)}.lw-about-title{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;margin-bottom:12px;color:#344054}.lw-info-icon{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border:1.5px solid #667085;border-radius:50%;font-size:10px;font-weight:700;color:#667085;line-height:1}.lw-about-body{display:flex;justify-content:space-between;gap:24px;align-items:flex-end}.lw-about-left{line-height:1.7;color:#344054}.lw-about-label{color:#344054}.lw-about a,.lw-about-linklike{color:#5b42f3;text-decoration:none}.lw-about-right{color:#344054;text-align:right;white-space:nowrap}.lw-copy-mark{display:inline-block;font-size:145%;line-height:0;position:relative;top:-.28em}.lw-modal-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;min-width:min(900px,80vw)}.lw-tabs-bar{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid #e5eaf3;margin-bottom:8px}.lw-tabs{display:flex;align-items:center;gap:18px}.lw-tabs button{border:0;background:transparent;padding:12px;color:#344054;font-weight:700;cursor:pointer}.lw-tabs button.active{color:#155eef;border-bottom:2px solid #155eef}.lw-enable-inline{display:flex;align-items:center;gap:8px;margin:0 0 0 auto;font-weight:700;color:#344054;white-space:nowrap;line-height:1}.lw-enable-inline span{display:inline-flex;align-items:center;height:18px}.lw-enable-inline input{margin:-7px 0 0 0}.lw-tab-panel{display:none;grid-column:1/-1;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.lw-tab-panel.active{display:grid}.lw-field span,.lw-toggle span{display:block;font-weight:700;margin-bottom:6px;color:#344054}.lw-wide{grid-column:1/-1}.lw-field textarea{min-height:86px}.lw-toggle{display:flex;align-items:center;justify-content:space-between;border:1px solid #e5eaf3;border-radius:8px;padding:10px 12px}.lw-toggle span{margin:0}.lw-icon-preview{height:40px;min-height:40px;border:1px solid #d7deea;border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:flex-start;color:#155eef;padding:0 12px}.lw-icon-preview-symbol{width:34px;height:34px;border-radius:50%;background:rgba(21,94,239,.08);display:inline-flex;align-items:center;justify-content:center;text-align:center;font-size:22px;line-height:34px}.right{text-align:right;margin-top:14px}.right .btn{margin-left:8px}@keyframes lwPulse{0%{box-shadow:0 0 0 0 rgba(245,158,11,.45)}70%{box-shadow:0 0 0 8px rgba(245,158,11,0)}100%{box-shadow:0 0 0 0 rgba(245,158,11,0)}}' +
	'.lan-wake{max-width:1280px}.lw-stats{grid-template-columns:repeat(5,minmax(0,1fr))}.lw-stat.blue .lw-stat-icon{background:#155eef;box-shadow:0 10px 18px rgba(21,94,239,.16)}.lw-filters{grid-template-columns:44px 44px 180px minmax(260px,520px) minmax(280px,1fr)}.lw-row{grid-template-columns:110px 1.4fr 1fr 1.2fr 1fr 2fr;min-width:780px}.lw-filters select,.lw-filters input,.lw-filters>button,.lw-toolbar-actions .btn{height:44px;min-height:44px;box-sizing:border-box}.lw-toolbar-actions .btn{display:inline-flex;align-items:center;justify-content:center;padding:0 14px}.lw-empty,.lw-empty h3,.lw-empty p{background:transparent!important}.modal.lw-modal,.cbi-modal.lw-modal{width:min(1040px,calc(100vw - 64px))!important;max-width:min(1040px,calc(100vw - 64px))!important;overflow-x:hidden!important;position:relative!important}.lw-modal,.lw-modal *{box-sizing:border-box!important}.lw-modal .modal-body,.lw-modal .cbi-section,.lw-modal>div{overflow-x:hidden!important}.lw-modal h4,.lw-modal .modal-title{font-size:16px!important;font-weight:700!important;border-radius:6px!important}.lw-modal-form{min-width:0!important;width:calc(100% - 24px)!important;max-width:calc(100% - 24px)!important;max-height:calc(100vh - 230px);box-sizing:border-box;overflow-y:auto;overflow-x:hidden!important;padding:2px 6px;margin:0 auto}.lw-tab-panel,.lw-field,.lw-toggle{min-width:0;max-width:100%}.lw-tab-panel.active{grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important}.lw-field input,.lw-field select,.lw-field textarea{width:100%!important;max-width:100%!important}.lw-toggle{min-height:48px}.lw-modal-actions{display:flex!important;justify-content:center!important;align-items:center!important;gap:10px;width:calc(100% - 24px)!important;max-width:calc(100% - 24px)!important;box-sizing:border-box;position:sticky;bottom:0;background:#fff;padding:12px 6px 0;margin:12px auto 0;z-index:2;overflow:visible!important;text-align:center!important}.lw-modal-actions .btn{display:inline-flex!important;align-items:center;justify-content:center;float:none!important;position:static!important;margin:0!important;min-width:76px;white-space:nowrap}.lw-modal-actions .cbi-button-positive{background:#155eef!important;border-color:#155eef!important;color:#fff!important}.lw-info-icon{position:relative;top:-1px}.lw-about a,.lw-about-linklike{color:#6F67E0}.lw-copy-mark{top:calc(-.08em + 7px)}' +
	'.lw-enable-inline input{position:relative!important;top:-1px!important;margin:0!important}.lw-field input,.lw-field select{height:40px!important;min-height:40px!important}.lw-modal-form>.lw-toggle{height:40px!important;min-height:40px!important;padding:0 12px!important;align-self:end!important}.lw-wake-stat-icon{width:23px;height:23px;display:block;background:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%2024%2024%27%20fill%3D%27none%27%20stroke%3D%27black%27%20stroke-width%3D%272.3%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%3E%3Cpath%20d%3D%27M21%2012a9%209%200%200%201-15%206.7L3%2016%27/%3E%3Cpath%20d%3D%27M3%2021v-5h5%27/%3E%3Cpath%20d%3D%27M3%2012a9%209%200%200%201%2015-6.7L21%208%27/%3E%3Cpath%20d%3D%27M21%203v5h-5%27/%3E%3C/svg%3E") center/23px 23px no-repeat;mask:url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%2024%2024%27%20fill%3D%27none%27%20stroke%3D%27black%27%20stroke-width%3D%272.3%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%3E%3Cpath%20d%3D%27M21%2012a9%209%200%200%201-15%206.7L3%2016%27/%3E%3Cpath%20d%3D%27M3%2021v-5h5%27/%3E%3Cpath%20d%3D%27M3%2012a9%209%200%200%201%2015-6.7L21%208%27/%3E%3Cpath%20d%3D%27M21%203v5h-5%27/%3E%3C/svg%3E") center/23px 23px no-repeat}.lw-svg-icon{display:block;width:24px;height:24px;background:currentColor;-webkit-mask:var(--lw-icon-url) center/contain no-repeat;mask:var(--lw-icon-url) center/contain no-repeat}.lw-icon-preview{height:40px!important;min-height:40px!important;box-sizing:border-box!important;margin:0!important;padding:0 12px!important;align-items:center!important;justify-content:flex-start!important}.lw-icon-preview-field .lw-icon-preview{position:relative!important;top:10px!important;margin-top:0!important}.lw-icon-preview-symbol{display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:1!important}.lw-settings-auto-check{position:absolute;top:33px;right:32px;z-index:3;display:flex;align-items:center;gap:6px;font-weight:700;color:#344054;white-space:nowrap}.lw-settings-auto-check span{margin:0}.lw-settings-auto-check input{position:relative!important;top:-1px!important;margin:0!important}.lw-filters{grid-template-columns:44px 44px 131px 245px minmax(260px,1fr)!important}.lw-grid{grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:14px!important}.lw-card{padding:14px!important}.lw-actions{gap:6px!important}.lw-actions .btn{padding:7px 9px!important}' +
	'.lw-icon-preview-field .lw-icon-preview{border-color:transparent!important;background:transparent!important;padding:0!important}.lw-icon-preview-field .lw-icon-preview-symbol{background:transparent!important;width:44px!important;height:40px!important;font-size:32px!important}.lw-icon-preview-field .lw-svg-icon{width:32px!important;height:32px!important}.lw-backend-wait{border:1px dashed #cbd5e1;border-radius:12px;background:#f8fafc;padding:36px 18px;text-align:center}.lw-backend-wait h3{margin:0 0 10px;font-size:18px;color:#1f1b4d}.lw-backend-wait p{margin:6px 0;color:#475467}.lw-backend-detail{font-size:12px;color:#98a2b3!important;word-break:break-all}' +
	'.lw-device-toggles{display:flex;align-items:center;justify-content:flex-end;gap:16px;flex-wrap:wrap;margin-left:auto}.lw-device-toggles .lw-enable-inline{margin:0}.lw-device-toggles .lw-enable-inline input{top:0!important}.lw-status-dot.online{background:#00966B!important}.lw-device-icon.online{background:rgba(0,150,107,.10)!important;color:#00966B!important}.lw-device-icon.offline{background:rgba(239,68,68,.10)!important;color:#ef4444!important}.lw-device-icon.waking{background:rgba(241,164,41,.13)!important;color:#F1A429!important}.lw-device-icon.unknown,.lw-device-icon.unchecked{background:rgba(102,112,133,.10)!important;color:#98a2b3!important}.lw-card[draggable=true]{cursor:grab}.lw-card.is-dragging{opacity:.45}.lw-card.is-drop-target{outline:2px dashed #155eef;outline-offset:4px;box-shadow:0 0 0 4px rgba(21,94,239,.08)!important}' +
	'.lw-scan-panel{border:1px solid #e5eaf3;border-radius:8px;background:#f8fafc;padding:12px;margin-bottom:4px}.lw-scan-title{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#344054;font-weight:800}.lw-scan-title .cbi-button-positive{background:#155eef!important;border-color:#155eef!important;color:#fff!important}.lw-scan-title .cbi-button-positive[disabled]{opacity:.65}.lw-scan-results{margin-top:10px}.lw-scan-empty{border:1px dashed #cbd5e1;border-radius:8px;padding:14px;text-align:center;color:#667085;background:#fff}.lw-scan-error{color:#b42318;border-color:#fecaca;background:#fff7f7}.lw-scan-table{border:1px solid #e5eaf3;border-radius:8px;overflow:auto;background:#fff}.lw-scan-row{display:grid;grid-template-columns:1fr 1.25fr 1.2fr 1.2fr 78px;gap:10px;align-items:center;padding:9px 12px;border-top:1px solid #eef2f7;min-width:760px;color:#344054}.lw-scan-row:first-child{border-top:0}.lw-scan-head{background:#f8fafc;color:#344054;font-weight:800}.lw-scan-row .btn{padding:6px 10px!important}' +
	'.lan-wake.is-modal-blurred{filter:blur(8px);opacity:.62;pointer-events:none;user-select:none;transition:filter .18s ease,opacity .18s ease}.lan-wake.lan-wake-dark.is-modal-blurred{opacity:.48}' +
	'.lw-inline-timer{margin-left:8px;color:#b45309;font-weight:800}' +
	'.lw-wake-btn{background:#fff!important;border-color:#00966B!important;color:#00966B!important}.lw-wake-btn-waking{background:#fff!important;border-color:#F1A429!important;color:#F1A429!important}' +
	'.lw-row-head{color:#344054!important;font-weight:800}.lw-list-head{color:#344054;font-weight:800}.lw-row:not(.lw-row-head){color:#344054}.lw-list-status{display:flex;align-items:center;gap:8px;font-weight:700;color:#344054}.lw-list-device{font-weight:800;color:#101828}.lw-list-ip,.lw-list-mac{color:#1f2a44;font-weight:500}.lw-list-seen{color:#344054;font-weight:700}.lw-list-actions{color:#344054}' +
	'.lan-wake.lan-wake-dark .lw-row-head,.lan-wake.lan-wake-dark .lw-list-head{color:#CCCCCC!important}.lan-wake.lan-wake-dark .lw-row:not(.lw-row-head){color:#e5e7eb!important}.lan-wake.lan-wake-dark .lw-list-status,.lan-wake.lan-wake-dark .lw-list-seen,.lan-wake.lan-wake-dark .lw-list-actions{color:#CCCCCC!important}.lan-wake.lan-wake-dark .lw-list-device{color:#f2f4f7!important}.lan-wake.lan-wake-dark .lw-list-ip,.lan-wake.lan-wake-dark .lw-list-mac{color:#d0d5dd!important}' +
	'@media (max-width:1250px){.lw-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}}@media (max-width:1000px){.lw-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}}@media (max-width:760px){.lw-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}' +
	'.lan-wake.lan-wake-dark{--ls-panel:rgba(255,255,255,.18);--ls-panel-soft:rgba(255,255,255,.24);--ls-border:rgba(255,255,255,.16);color:#e5e7eb}.lan-wake.lan-wake-dark .lw-head h2{background:var(--ls-panel);border:1px solid var(--ls-border);color:#CCCCCC;box-shadow:0 8px 18px rgba(0,0,0,.18)}.lan-wake.lan-wake-dark .lw-card,.lan-wake.lan-wake-dark .lw-stat,.lan-wake.lan-wake-dark .lw-table,.lan-wake.lan-wake-dark .lw-about,.lan-wake.lan-wake-dark .lw-backend-wait{background:var(--ls-panel)!important;border-color:var(--ls-border)!important;color:#e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,.16)}.lan-wake.lan-wake-dark .lw-card.st-online,.lan-wake.lan-wake-dark .lw-card.st-offline,.lan-wake.lan-wake-dark .lw-card.st-waking,.lan-wake.lan-wake-dark .lw-card.st-shutting,.lan-wake.lan-wake-dark .lw-card.st-unknown,.lan-wake.lan-wake-dark .lw-card.st-unchecked{background:var(--ls-panel)!important}.lan-wake.lan-wake-dark .btn,.lan-wake.lan-wake-dark .lw-filters input,.lan-wake.lan-wake-dark .lw-filters select,.lan-wake.lan-wake-dark .lw-field input,.lan-wake.lan-wake-dark .lw-field select,.lan-wake.lan-wake-dark .lw-field textarea{background:var(--ls-panel-soft)!important;color:#e5e7eb!important;border-color:var(--ls-border)!important}.lan-wake.lan-wake-dark .cbi-button-positive{background:var(--lw-blue)!important;color:#fff!important;border-color:var(--lw-blue)!important}.lan-wake.lan-wake-dark .lw-head p,.lan-wake.lan-wake-dark .lw-stat-label,.lan-wake.lan-wake-dark .lw-meta,.lan-wake.lan-wake-dark .lw-about-left,.lan-wake.lan-wake-dark .lw-about-right,.lan-wake.lan-wake-dark .lw-about-label,.lan-wake.lan-wake-dark .lw-addr,.lan-wake.lan-wake-dark .lw-backend-wait p{color:#d0d5dd!important}.lan-wake.lan-wake-dark .lw-name,.lan-wake.lan-wake-dark .lw-meta b,.lan-wake.lan-wake-dark .lw-field span,.lan-wake.lan-wake-dark .lw-toggle span,.lan-wake.lan-wake-dark .lw-about-title,.lan-wake.lan-wake-dark .lw-status-text,.lan-wake.lan-wake-dark .lw-stat-value,.lan-wake.lan-wake-dark .lw-empty h3,.lan-wake.lan-wake-dark .lw-backend-wait h3{color:#CCCCCC!important}.lan-wake.lan-wake-dark .lw-row-head,.lan-wake.lan-wake-dark .lw-empty{background:var(--ls-panel)!important;border-color:var(--ls-border)!important}.lan-wake.lan-wake-dark .lw-row{border-color:var(--ls-border)!important}.lan-wake.lan-wake-dark .lw-device-icon{background:rgba(255,255,255,.14)!important}.lan-wake.lan-wake-dark .lw-modal-actions{background:transparent}.lan-wake.lan-wake-dark .lw-wake-btn,.lan-wake.lan-wake-dark .lw-wake-btn-waking{background:transparent!important}.lan-wake.lan-wake-dark .lw-about a,.lan-wake.lan-wake-dark .lw-about-linklike{color:#9b94ff!important}' +
	'.lan-wake-dark-page .lw-scan-panel,.lan-wake-dark-page .lw-scan-table,.lan-wake-dark-page .lw-scan-empty{background:var(--ls-panel)!important;border-color:var(--ls-border)!important;color:#d0d5dd!important}.lan-wake-dark-page .lw-scan-title,.lan-wake-dark-page .lw-scan-head{color:#CCCCCC!important}.lan-wake-dark-page .lw-scan-head{background:var(--ls-panel-soft)!important}.lan-wake-dark-page .lw-scan-row{border-color:var(--ls-border)!important;color:#e5e7eb!important}' +
	'.lan-wake-dark-page{--ls-panel:rgba(255,255,255,.18);--ls-panel-soft:rgba(255,255,255,.24);--ls-border:rgba(255,255,255,.16)}.lan-wake-dark-page .modal.lw-modal,.lan-wake-dark-page .cbi-modal.lw-modal{background:var(--ls-panel)!important;border:1px solid var(--ls-border)!important;color:#e5e7eb!important;box-shadow:0 18px 48px rgba(0,0,0,.45)!important}.lan-wake-dark-page .lw-modal h4,.lan-wake-dark-page .lw-modal .modal-title{background:var(--ls-panel-soft)!important;color:#CCCCCC!important;border-color:var(--ls-border)!important}.lan-wake-dark-page .lw-modal .modal-body,.lan-wake-dark-page .lw-modal .cbi-section,.lan-wake-dark-page .lw-modal>div{background:transparent!important;color:#e5e7eb!important}.lan-wake-dark-page .lw-modal-form,.lan-wake-dark-page .lw-tab-panel,.lan-wake-dark-page .lw-tabs-bar{background:transparent!important;border-color:var(--ls-border)!important}.lan-wake-dark-page .lw-modal .lw-field input,.lan-wake-dark-page .lw-modal .lw-field select,.lan-wake-dark-page .lw-modal .lw-field textarea{background:var(--ls-panel-soft)!important;color:#e5e7eb!important;border-color:var(--ls-border)!important;box-shadow:none!important}.lan-wake-dark-page .lw-modal .lw-field select,.lan-wake.lan-wake-dark .lw-filters select,.lan-wake.lan-wake-dark .lw-field select{color-scheme:dark;background-color:rgba(255,255,255,.24)!important;color:#e5e7eb!important}.lan-wake-dark-page .lw-modal .lw-field select option,.lan-wake.lan-wake-dark select option{background:#2b2d31!important;color:#e5e7eb!important}.lan-wake-dark-page .lw-modal .lw-field select option:checked,.lan-wake.lan-wake-dark select option:checked{background:#4f46e5!important;color:#fff!important}.lan-wake-dark-page .lw-modal .lw-field select option:hover,.lan-wake.lan-wake-dark select option:hover{background:#3b3d44!important;color:#fff!important}.lan-wake-dark-page .lw-modal .lw-field input:focus,.lan-wake-dark-page .lw-modal .lw-field select:focus,.lan-wake-dark-page .lw-modal .lw-field textarea:focus{border-color:#8b84ff!important;box-shadow:0 0 0 2px rgba(139,132,255,.22)!important}.lan-wake-dark-page .lw-modal .lw-field input::placeholder,.lan-wake-dark-page .lw-modal .lw-field textarea::placeholder{color:#b8c0cc!important}.lan-wake-dark-page .lw-modal .lw-field span,.lan-wake-dark-page .lw-modal .lw-toggle span,.lan-wake-dark-page .lw-modal .lw-enable-inline,.lan-wake-dark-page .lw-modal .lw-settings-auto-check{color:#CCCCCC!important}.lan-wake-dark-page .lw-modal .lw-tabs button{color:#b8c0cc!important}.lan-wake-dark-page .lw-modal .lw-tabs button.active{color:#8b84ff!important;border-bottom-color:#8b84ff!important}.lan-wake-dark-page .lw-modal .lw-icon-preview{background:transparent!important;border-color:transparent!important;color:#cdd3df!important}.lan-wake-dark-page .lw-modal .lw-modal-actions{background:transparent!important;border-color:transparent!important}.lan-wake-dark-page .lw-modal .btn{background:var(--ls-panel-soft)!important;color:#e5e7eb!important;border-color:var(--ls-border)!important}.lan-wake-dark-page .lw-modal .cbi-button-positive{background:#4f46e5!important;color:#fff!important;border-color:#4f46e5!important}' +
	'@media (max-width:1100px){.lw-filters{grid-template-columns:44px 44px 1fr 1fr}.lw-filters input{grid-column:1/-1}.lw-toolbar-actions{grid-column:1/-1;justify-content:flex-end}}@media (max-width:900px){.lw-head{display:block}.lw-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.lw-about-body{display:block}.lw-about-right{text-align:left;margin-top:12px;white-space:normal}.lw-modal-form,.lw-tab-panel.active{grid-template-columns:1fr;min-width:0}.lw-wide{grid-column:auto}}@media (max-width:560px){.lw-stats,.lw-filters,.lw-grid{grid-template-columns:1fr}.lw-toolbar-actions{justify-content:stretch}.lw-toolbar-actions .btn{flex:1}.lw-card{border-radius:8px}.lw-actions .btn{flex:1;text-align:center}.lw-head h2{font-size:22px}}';
}

return view.extend({
	load: function() {
		return loadData();
	},

		render: function(data) {
		var root = E('div');
		if (!data.ok) {
			renderBackendLoading(root, data.error);
			return root;
		}
		applyLoadedData(data);
		renderBody(root);
		startTimers(root);
		return root;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
