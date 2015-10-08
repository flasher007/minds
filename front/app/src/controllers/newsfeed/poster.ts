import { Component, View, CORE_DIRECTIVES, FORM_DIRECTIVES, EventEmitter } from 'angular2/angular2';
import { ROUTER_DIRECTIVES } from 'angular2/router';
import { Client, Upload } from 'src/services/api';
import { Material } from 'src/directives/material';
import { InfiniteScroll } from '../../directives/infinite-scroll';
import { Activity } from './activity';
import { MindsActivityObject } from 'src/interfaces/entities';
import { SessionFactory } from 'src/services/session';

@Component({
  selector: 'minds-newsfeed-poster',
  viewBindings: [ Client, Upload ],
  properties: ['_container_guid: containerGuid'],
  events: ['loadHandler: load']
})
@View({
  templateUrl: 'templates/newsfeed/poster.html',
  directives: [ Activity, Material, CORE_DIRECTIVES, FORM_DIRECTIVES, ROUTER_DIRECTIVES, InfiniteScroll ]
})

export class Poster {

  session = SessionFactory.build();
  minds;
  video: boolean = false;
  loadHandler: EventEmitter = new EventEmitter();
  inProgress : boolean = false;

  attachment_preview;

  postMeta : any = {
    title: "",
    description: "",
    thumbnail: "",
    url: "",
    active: false,
    attachment_guid: null,
    container_guid: 0
  }

	constructor(public client: Client, public upload: Upload){
    this.minds = window.Minds;
	}

  set _container_guid(value : any){
    this.postMeta.container_guid = value;
  }

	/**
	 * Post to the newsfeed
	 */
	post(){
		var self = this;
    this.inProgress = true;
    this.client.post('api/v1/newsfeed', this.postMeta)
      .then(function(data){
  			self.loadHandler.next(data.activity);
        self.inProgress = false;
        //reset
        self.postMeta = {
          message: "",
          title: "",
          description: "",
          thumbnail: "",
          url: "",
          active: false,
          attachment_guid: null,
          container_guid: self.postMeta.container_guid
        }
        self.attachment_preview = null;
  		})
  		.catch(function(e){
  			self.inProgress = false;
  		});
	}

  uploadAttachment(){
    var self = this;
    var file : any = document.getElementById("file");

    console.log(file);
    var fileInfo = file ? file.files[0] : null;

    if(!fileInfo)
      return;

    /**
     * Give a live preview
     */
    this.video = this.isVideo(fileInfo.name);

    var reader  = new FileReader();
    reader.onloadend = () => {
      this.attachment_preview = reader.result;
    }
    reader.readAsDataURL(fileInfo);

    /**
     * Upload to the archive and return the attachment guid
     */
    this.upload.post('api/v1/archive', [fileInfo], this.postMeta)
      .then((response : any) => {
        self.postMeta.attachment_guid = response.guid;
      });

  }

  removeAttachment(){
    var self = this;
    var file : any = document.getElementById("file");
    file.value = "";

    this.attachment_preview = null;
    this.client.delete('api/v1/archive/' + this.postMeta.attachment_guid)
      .then((response) => {
        self.postMeta.attachment_guid = null;
      });
  }

  /**
   * Get rich embed data
   */
  timeout;
  getPostPreview(message){
    var self = this;

    var match = message.value.match(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig);
		if (!match) return;
    var url;

		if ( match instanceof Array) {
			url = match[0];
		} else {
			url = match;
		}

		if (!url.length) return;

		url = url.replace("http://", '');
		url = url.replace("https://", '');
    console.log('found url was ' + url)

    self.postMeta.active = true;

    if(this.timeout)
      clearTimeout(this.timeout);

    this.timeout = setTimeout(()=>{
      this.client.get('api/v1/newsfeed/preview', {url: url})
        .then((data : any) => {
          console.log(data);
          self.postMeta.title = data.meta.title;
          self.postMeta.url = data.meta.canonical;
          self.postMeta.description = data.meta.description;
          for (var link of data.links) {
              if (link.rel.indexOf('thumbnail') > -1) {
                  self.postMeta.thumbnail = link.href;
              }
          }
        });
    }, 600);
  }

  getExtension(filename) {
    var parts = filename.split('.');
    return parts[parts.length - 1];
  }

  isVideo(filename) {
    var ext = this.getExtension(filename);
    switch (ext.toLowerCase()) {
    case 'mp4':
    case 'ogg':
    case 'webm':
        return true;
    }
    return false;
  }

}
