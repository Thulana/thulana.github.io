---
title: "Nginx With SSL inside docker"

---

Lets deploy a nginx server in docker with SSL enabled port. Before we try to work with nginx, first of all lets create a self signed certificate. SSL (Secure Socket Layer ) enable us to communicate with web servers, websites securely. In SSL a certificate is used to verify the authenticity of a website. To enable SSL lets create a self signed certificate for our purpose.

<figure>
  <img src="{{ base_path }}/images/post6-1.jpeg" alt="nginx">
</figure>

In linux it is easy to create a self signed certificate using openssl. What you have to do is, just run the below commands and provide data for the questions prompt.

``sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout <path>/<key_name>.key -out <path>/<certificate_name>.crt``

Once you correctly give the data necessary and a path and a name, key will be created.

Lets start with nginx, First lets see what we wants to get up and running a nginx server with SSL. First we need a,

    1. Dockerfile for the image
    2. SSL certificate and the key
    3. Nginx config file

We can create a dockerfile for a customized container like below, but just for now I'm going to use the nginx latest base image. We can skip that part and can create a container from the nginx base image. So don’t worry about the dockerfile in this exercise.

```
FROM nginx:latest
//addd all you want here
```

Now you have the certificate file and the key that we created before. Create a folder private,ssl,log and config. We are going to map these locations with respective locations in the nginx container. Then copy the certificate file to ssl folder and key file to private folder. We will make these locations volumes in the run command.

Then lets create nginx config file to enable ssl for a server. Create a nginx.conf file in config folder and include these lines.

```

events {
  worker_connections  1024;  ## Default: 1024
}

http{

	server {
	    listen 443;

	    ssl on;
	    server_name mydomain.com www.mydomain.com;
	    ssl_certificate    /etc/ssl/certs/nginx.crt;
	    ssl_certificate_key    /etc/ssl/private/nginx.key;

	    ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
	    ssl_prefer_server_ciphers on;
	    ssl_ciphers AES256+EECDH:AES256+EDH:!aNULL;

		location / {
            try_files $uri $uri/ /index.html;
		}

		error_page 404 /404.html;

		error_page 500 502 503 504 /50x.html;
		location = /50x.html {
		      root /usr/share/nginx/html;
		}


		
	    
	}

	server {
	     listen 80 default_server;
		 ##listen [::]:7070 default_server ipv6only=off;

		 root /usr/share/nginx/html;
		 index index.php index.html index.htm;

		 server_name example.com;

	

	}

}
```

Nginx config file has basic two blocks. We define our servers in http block. In default settings nginx listen on port 80 and 443. What we are going to do is enable ssl for port 443. within http block there are two server block. We have two server blocks for port 80 and 443. In 443 block we have enabled the ssl and provided the paths to certificate file and the key.

In the locations, we can define where should the request go according to the url. Here lets create index.html file and send all request to it. Another server block is there for port 80 but here ssl is not enabled.

To identify if our server works, add a index.html file within html folder inside config folder. Now everything is ready. Lets start the engineX.

```
docker run -d -p 9090:443 -p 7070:80 -v $PWD/log:/var/log/nginx -v $PWD/ssl:/etc/ssl/certs -v $PWD/private:/etc/ssl/private -v $PWD/config:/etc/nginx — name nginx-server nginx
```

Here what we do is map localhost:9090 port with nginx 443 and localhost:7070 with 80. And then all the folders we created are marked and linked as volumes so data persists both locally and internally. Then we run a container in name nginx-server from nginx.

If there was no error, this command will launch the server. You can luanch it in daemon mode and verify if it’s running by docker ps command.

Go to your web browser an type “Https://localhost:9090/”. As this is mapped with ssl enabled 443 port in nginx, the index page will be displayed.

If we try Https://localhost:7070/ it will say this server can’t accept secure connection. That means port 80 is configured for http. So Http://localhost:7070/ will display the index file as this port supports http.

Hope you learn something about nginx in docker. If you had troubles, here is the one i did. You can find the docker commands in dockerfile. Cheers !!!!

Project : [GitHub project](https://github.com/Thulana/docker_nginx)