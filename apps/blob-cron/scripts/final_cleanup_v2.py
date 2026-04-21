#!/usr/bin/env python3
import asyncio
import httpx

async def cleanup():
    list_url = "https://api.blob.njmtech.co.za/api/v1/blob/files"
    list_headers = {"Authorization": "Bearer 9kKAtYdMCgmGrMAVS818vnOkoHfDZkc9i"}
    
    delete_url = "https://blob.vercel-storage.com/delete"
    delete_headers = {"Authorization": "Bearer vercel_blob_rw_fxw7x7LUyCsSVOGX_72mj1Mp7AFFN33zxDKgcpOFfaZiV3k"}
    
    print("Listing all blobs for cleanup...")
    async with httpx.AsyncClient() as client:
        resp = await client.get(list_url, headers=list_headers)
        if resp.status_code != 200:
            print(f"Error listing: {resp.text}")
            return
            
        data = resp.json().get('data', [])
        urls_to_delete = []
        
        for item in data:
            md_url = item.get('md_url')
            if md_url:
                # Based on user feedback, these are all mistakes to be purged
                print(f"Queuing for deletion: {md_url}")
                urls_to_delete.append(md_url)
        
        if not urls_to_delete:
            print("No mistake md_urls found to clean up.")
            return
            
        print(f"Deleting {len(urls_to_delete)} files...")
        # Vercel delete takes up to 1000 URLs
        for i in range(0, len(urls_to_delete), 100):
            chunk = urls_to_delete[i:i+100]
            del_resp = await client.post(delete_url, json={"urls": chunk}, headers=delete_headers)
            print(f"Batch {i//100 + 1} response: {del_resp.status_code}")

if __name__ == "__main__":
    asyncio.run(cleanup())
