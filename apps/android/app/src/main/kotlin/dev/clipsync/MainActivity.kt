package dev.clipsync

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.clipsync.data.model.ClipContentType
import dev.clipsync.data.model.ClipItem
import dev.clipsync.data.model.PairedDevice
import dev.clipsync.service.ClipboardCaptureService
import dev.clipsync.ui.theme.ClipSyncTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ClipboardCaptureService.start(this)

        setContent {
            ClipSyncTheme {
                ClipSyncApp()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ClipSyncApp() {
    var selectedTab by remember { mutableIntStateOf(0) }
    var syncActive by remember { mutableStateOf(true) }

    val mockDevices = remember {
        listOf(
            PairedDevice("mac-1", "MacBook Pro", "macOS", true),
            PairedDevice("win-1", "ThinkPad X1", "Windows", true),
            PairedDevice("lin-1", "Ubuntu Workstation", "Linux", false)
        )
    }

    val mockClips = remember {
        mutableStateListOf(
            ClipItem("c1", "mac-1", ClipContentType.TEXT, "git checkout -b feat/phase-3", 31, "hash1", true),
            ClipItem("c2", "win-1", ClipContentType.URL, "https://clipsync.dev/dashboard", 29, "hash2", false),
            ClipItem("c3", "android-local", ClipContentType.TEXT, "Meeting notes: sync engine validated", 36, "hash3", false)
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("ClipSync") },
                actions = {
                    IconButton(onClick = { syncActive = !syncActive }) {
                        Icon(
                            imageVector = if (syncActive) Icons.Default.Sync else Icons.Default.SyncDisabled,
                            contentDescription = "Sync Toggle",
                            tint = if (syncActive) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                        )
                    }
                }
            )
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.Dashboard, contentDescription = "Dashboard") },
                    label = { Text("Dashboard") }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.Default.History, contentDescription = "History") },
                    label = { Text("History") }
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.Default.Devices, contentDescription = "Devices") },
                    label = { Text("Devices") }
                )
                NavigationBarItem(
                    selected = selectedTab == 3,
                    onClick = { selectedTab = 3 },
                    icon = { Icon(Icons.Default.Settings, contentDescription = "Settings") },
                    label = { Text("Settings") }
                )
            }
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding).fillMaxSize()) {
            when (selectedTab) {
                0 -> DashboardTab(mockDevices, mockClips)
                1 -> HistoryTab(mockClips)
                2 -> DevicesTab(mockDevices)
                3 -> SettingsTab(syncActive) { syncActive = it }
            }
        }
    }
}

@Composable
fun DashboardTab(devices: List<PairedDevice>, clips: List<ClipItem>) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Connected Devices", style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        devices.forEach { device ->
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(
                                    imageVector = if (device.isOnline) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                                    contentDescription = null,
                                    tint = if (device.isOnline) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline
                                )
                                Text(device.platform, style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }
            }
        }

        item {
            Text("Recent Clipboard Activity", style = MaterialTheme.typography.titleMedium)
        }

        items(clips) { clip ->
            ClipCard(clip)
        }
    }
}

@Composable
fun HistoryTab(clips: List<ClipItem>) {
    var searchQuery by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Search clipboard history...") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            singleLine = true
        )
        Spacer(modifier = Modifier.height(16.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            val filtered = if (searchQuery.isBlank()) clips else clips.filter { it.content.contains(searchQuery, ignoreCase = true) }
            items(filtered) { clip ->
                ClipCard(clip)
            }
        }
    }
}

@Composable
fun DevicesTab(devices: List<PairedDevice>) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Button(
                onClick = {},
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.QrCodeScanner, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Pair New Device via QR Code")
            }
        }
        items(devices) { device ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(device.name, style = MaterialTheme.typography.titleSmall)
                        Text(device.platform, style = MaterialTheme.typography.bodySmall)
                    }
                    AssistChip(
                        onClick = {},
                        label = { Text(if (device.isOnline) "Online" else "Offline") }
                    )
                }
            }
        }
    }
}

@Composable
fun SettingsTab(syncActive: Boolean, onSyncChange: (Boolean) -> Unit) {
    var ignorePasswords by remember { mutableStateOf(true) }
    var ignoreTokens by remember { mutableStateOf(true) }
    var syncImages by remember { mutableStateOf(true) }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Configuration", style = MaterialTheme.typography.titleLarge)
        Spacer(modifier = Modifier.height(16.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Automatic Synchronization")
            Switch(checked = syncActive, onCheckedChange = onSyncChange)
        }

        Spacer(modifier = Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Ignore Password Managers")
            Switch(checked = ignorePasswords, onCheckedChange = { ignorePasswords = it })
        }

        Spacer(modifier = Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Filter Sensitive Auth Tokens")
            Switch(checked = ignoreTokens, onCheckedChange = { ignoreTokens = it })
        }

        Spacer(modifier = Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Synchronize Images")
            Switch(checked = syncImages, onCheckedChange = { syncImages = it })
        }
    }
}

@Composable
fun ClipCard(clip: ClipItem) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = clip.content,
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 2
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(clip.contentType.name, style = MaterialTheme.typography.labelSmall)
                    Text("•", style = MaterialTheme.typography.labelSmall)
                    Text(clip.sourceDeviceId, style = MaterialTheme.typography.labelSmall)
                }
            }
            IconButton(onClick = {}) {
                Icon(
                    imageVector = if (clip.isPinned) Icons.Default.PushPin else Icons.Default.ContentCopy,
                    contentDescription = null
                )
            }
        }
    }
}
