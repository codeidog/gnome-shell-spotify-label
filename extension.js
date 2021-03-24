const St = imports.gi.St;
const Main = imports.ui.main;
const Soup = imports.gi.Soup;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const PanelMenu = imports.ui.panelMenu;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

//"User-defined" constants. If you've stumbled upon this extension, these values are the most likely you'd like to change.
let LEFT_PADDING, MAX_STRING_LENGTH, REFRESH_RATE, FRIENDLY_GREETING, ARTIST_FIRST,  EXTENSION_PLACE, EXTENSION_INDEX, gschema, lastExtensionPlace, lastExtensionIndex;
var settings, onLeftPaddingChanged, onExtensionPlaceChanged, onExtensionIndexChanged;
let _httpSession;
let spMenu;
let panel, songButton, nextbutton, previousbutton, timeout, animation;
let songlabel = "";
let max_int_length = 30;
let chr_scroll = 1, scroll_index = 0;
let artist_first= true;
function loadData()
{
    //log("Spotify: Loading data")
    let [res, out, err, status] = [];
		try {			
			inittoggle();
			//Use GLib to send a dbus request with the expectation of receiving an MPRIS v2 response.
			[res, out, err, status] = GLib.spawn_command_line_sync("dbus-send --print-reply --dest=org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2 org.freedesktop.DBus.Properties.Get string:org.mpris.MediaPlayer2.Player string:Metadata");
		}
		catch(err) {
			refreshUI("Error. Please check system logs.");
			global.log("spotifylabel: res: " + res + " -- status: " + status + " -- err:" + err);
			return;
		}		
		var labelstring = parseSpotifyData(out.toString());
		if(labelstring.length == 0)
		{
			labelstring = 'No song is currently playing'						
		}
		songlabel = refreshUI(labelstring);
        return true;
}

function refreshUI(data)
{
    //log("Spotify: setting the ui")    
    let txt = data.toString()
    //log("spotify: value to set is" +txt)
	songButton.set_label(txt)	
	return txt;
}

function textScrollAnimation()
{	
	try{	
	if(songlabel.length > max_int_length)
	{				
		//Reached end of string
		if(scroll_index > songlabel.length)
		{
			scroll_index = 0;
		}
		let scroll_max = scroll_index + max_int_length;
		let display = "";
		if(scroll_max > songlabel.length)
		{						
			display = " " + songlabel.substring(0, Math.abs(scroll_max - songlabel.length) )
			scroll_max = songlabel.length;			
			log("beging: " + display)
		}						
		display = songlabel.substring(scroll_index, scroll_max) + display;
		log("Index: " + scroll_index + " Scroll_max: " + scroll_max);
		log("String: " + display);
		log(" ")
		songButton.set_label(display);
		scroll_index += chr_scroll;
	}
	else
	{				
		songButton.set_label(songlabel);
	}
	return true;
}
	catch(err)
	{
		songButton.set_label("An error occurred");
		log("IdoSpotifyManager: " + err);
		return;
	}

}
//Open the Spotify application
function openApp()
{
    throw "Not implemented"
}

function sendDBusCommand(command)
{
 //   log("Spotify: performing action - " + command.toString())
   // log("Spotify: accessible name is: " + command.accessible_name.toString())
    let [res, out, err, status] = [];
		try {
			//Use GLib to send a dbus request with the expectation of receiving an MPRIS v2 response.
			[res, out, err, status] = GLib.spawn_command_line_sync("dbus-send --print-reply --dest=org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player."+command.accessible_name.toString());
		}
		catch(err) {
			refreshUI("Error. Please check system logs.");
			global.log("spotifylabel: res: " + res + " -- status: " + status + " -- err:" + err);
			return;
		}
}
function init()
{
    
}


function enable()
{    
	//Create the panel that will hold all the elements
    //log("creating the elements")
    panel = new St.BoxLayout({
		style_class: "panel"
		
	});
	//Create the button that will display artist - song and allow play plause when clicking
	
	songButton = new St.Button({
		accessible_name: "PlayPause",
		y_align: Clutter.ActorAlign.CENTER,
		x_align: Clutter.ActorAlign.FILL,
		label: "No song is currently playing",
		style_class: "songlabel",
		toggle_mode: true
	});		    
    
    //Create the next song button
		nextbutton = new St.Button({
			style_class: "mediabtn",		
			accessible_name: "Next",
			y_align: Clutter.ActorAlign.CENTER,
			x_align: Clutter.ActorAlign.FILL
		});		
    //Create and attach the icon to the button
        nextbutton.child = new St.Icon({
            gicon: Gio.icon_new_for_string(Me.dir.get_child('icons').get_path() + "/" + "next.svg"),
            style_class: "media-control"
        });
    //Create the previous song buttong
        previousbutton = new St.Button({
            style_class: "mediabtn",		
			accessible_name: "Previous",
			y_align: Clutter.ActorAlign.CENTER,
			x_align: Clutter.ActorAlign.FILL
        })
    //Create and attach the icon to the button
    previousbutton.child = new St.Icon({
            gicon: Gio.icon_new_for_string(Me.dir.get_child('icons').get_path() + "/" + "previous.svg"),
            style_class: "media-control"
        });
    //Attach a method to each button
        previousbutton.connect('clicked',sendDBusCommand);
		nextbutton.connect('clicked',sendDBusCommand);
		songButton.connect('clicked',sendDBusCommand);
	panel.add(previousbutton);
	//panel.add(playpause)
    panel.add(songButton);
	panel.add(nextbutton);
	
    //log("appending the the elemts to the ui")    
    Main.panel._rightBox.insert_child_at_index(panel,0);
	inittoggle()
	timeout = Mainloop.timeout_add_seconds(2.0,loadData)
	//animation = Mainloop.timeout_add(200, textScrollAnimation);
}

function inittoggle()
{	
	var checked= false
	let [res, out, err, status] = [];
		try {
			//Get the current play staus.
			[res, out, err, status] = GLib.spawn_command_line_sync("dbus-send --print-reply --dest=org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2 org.freedesktop.DBus.Properties.Get string:org.mpris.MediaPlayer2.Player string:PlaybackStatus");
			var outstring = out.toString();
			var state = outstring.split("\"")[1];
			if(state.toLowerCase() === 'playing'){
				checked = true
			}
		}
		//Spotify not playing
		catch(err) {			
			//global.log("spotifylabel: sporify not playing");			
		}
		finally{
			//global.log("spotifylabel: Setting checked to " + checked)
			songButton.set_checked(checked)
		}
}


function disable()
{
	Mainloop.source_remove(timeout);
	//Mainloop.source_remove(animation);
    Main.panel._rightBox.remove_child(panel);    
}
//Spotify uses MIPRIS v2, and as such the metadata fields are prefixed by 'xesam'
//We use this info to set our limits,and assume the data is properly escaped within quotes.
function parseSpotifyData(data) {
    //log("spotify: Parsing spotify data\n"+data)
	if(data.length <= 0)
	{
		songButton.set_checked(false)
		return "No spotify data found"
	}
		

	var titleBlock = data.substring(data.indexOf("xesam:title"));
	var title = titleBlock.split("\"")[2]

	var artistBlock = data.substring(data.indexOf("xesam:artist"));
	var artist = artistBlock.split("\"")[2]

	//If the delimited '-' is  in the title, we assume that it's remix, and encapsulate the end in brackets.
	if(title.includes("-"))
		title = title.replace("- ", "(") + ")";

	//If the name of either string is too long, cut off and add '...'
	if (artist.length > max_int_length) //this.settings.get_int('max-string-length'))
		artist = artist.substring(0, max_int_length) +"..."; //this.settings.get_int('max-string-length')) + "...";

	if (title.length > max_int_length) //this.settings.get_int('max-string-length'))
		title = title.substring(0, max_int_length) +"..."; //this.settings.get_int('max-string-length')) + "...";

	if (title.includes("xesam") || artist.includes("xesam"))
		return "Loading..."

	if (artist_first){//this.settings.get_boolean('artist-first')) {
    	return (artist + " - " + title);
  	}
  	return (title + " - " + artist);
}