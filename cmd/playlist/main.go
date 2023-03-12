package main

import (
	"log"
	"net/http"
)

func main() {
	listen := ":8080"
	log.Println("Listening on", listen)
	log.Fatal(http.ListenAndServe(listen, http.FileServer(http.Dir("."))))
}
